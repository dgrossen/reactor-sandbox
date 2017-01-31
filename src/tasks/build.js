/*************************************************************************
 * ADOBE CONFIDENTIAL
 * ___________________
 *
 *  Copyright 2016 Adobe Systems Incorporated
 *  All Rights Reserved.
 *
 * NOTICE:  All information contained herein is, and remains
 * the property of Adobe Systems Incorporated and its suppliers,
 * if any.  The intellectual and technical concepts contained
 * herein are proprietary to Adobe Systems Incorporated and its
 * suppliers and are protected by all applicable intellectual property
 * laws, including trade secret and copyright laws.
 * Dissemination of this information or reproduction of this material
 * is strictly forbidden unless prior written permission is obtained
 * from Adobe Systems Incorporated.
 **************************************************************************/

'use strict';

/**
 * Builds a static, standalone sandbox directory. Does not provide any web server.
 * The created directory is "sandbox" under the current working directory.
 */

var path = require('path');
var fs = require('fs-extra');
var webpack = require('webpack');
var chalk = require('chalk');
var validateExtensionDescriptor = require('@adobe/composer-validator');
var getExtensionDescriptor = require('./helpers/getExtensionDescriptor');
var getExtensionDescriptorScript = require('./helpers/getExtensionDescriptorScript');
var getContainer = require('./helpers/getContainer');
var files = require('./constants/files');
var replace = require('replace-in-file');

module.exports = function() {
  var extensionDescriptor = getExtensionDescriptor();
  var validationError = validateExtensionDescriptor(extensionDescriptor);

  if (validationError) {
    console.log(chalk.red(validationError));
    process.exit(1);
  }

  fs.ensureDirSync(files.DIST_PATH);

  fs.writeFileSync(path.resolve(files.DIST_PATH, files.EXTENSION_DESCRIPTOR_SCRIPT_FILENAME),
    getExtensionDescriptorScript());

  fs.copySync(files.TURBINE_ENGINE_PATH, path.resolve(files.DIST_PATH, files.ENGINE_FILENAME));

  // Produces viewSandbox.js
  var webpackConfig = require('./webpack.viewSandbox.config');
  webpackConfig.output.path = files.DIST_PATH;
  webpack(webpackConfig).run(function() {});

  var extensionViewsPath = path.resolve(extensionDescriptor.viewBasePath);
  fs.copySync(extensionViewsPath, path.resolve(files.DIST_PATH, files.EXTENSION_VIEWS_DIRNAME));

  fs.copySync(files.CLIENT_SRC_PATH, files.DIST_PATH);

  try {
    fs.copySync(files.CONSUMER_CLIENT_SRC_PATH, files.DIST_PATH);
  } catch (error) {
    // It will throw an error if the consumer doesn't have an override directory. That's okay.
  }

  fs.writeFileSync(path.resolve(files.DIST_PATH, files.CONTAINER_FILENAME), getContainer());

  // We need to replace the extension bridge from akamai with one that is bundled inside the build.
  fs.copySync(files.EXTENSION_BRIDGE_PATH, files.DIST_PATH);

  replace.sync({
    files: path.join(path.resolve(files.DIST_PATH, files.EXTENSION_VIEWS_DIRNAME), '*\.html'),
    replace: new RegExp('<script.*src=".*' + files.EXTENSION_BRIDGE + '".*?></script>', 'igm'),
    with: '<script src="../' + files.EXTENSION_BRIDGE + '"></script>' +
          '<script src="../' + files.EXTENSION_BRIDGE_CHILD + '"></script>',
    allowEmptyPaths: false
  });

  replace.sync({
    files: path.join(path.resolve(files.DIST_PATH, 'noConfigIframe\.html')),
    replace: new RegExp('<script.*src=".*' + files.EXTENSION_BRIDGE + '".*?></script>', 'igm'),
    with: '<script src="./' + files.EXTENSION_BRIDGE + '"></script>' +
    '<script src="./' + files.EXTENSION_BRIDGE_CHILD + '"></script>',
    allowEmptyPaths: false
  });

  replace.sync({
    files: path.resolve(path.join(files.DIST_PATH, files.EXTENSION_BRIDGE)),
    replace: new RegExp('/extensionbridge/' + files.EXTENSION_BRIDGE_CHILD),
    with: 'about:blank',
    allowEmptyPaths: false
  });
};

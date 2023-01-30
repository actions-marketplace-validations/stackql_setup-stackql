const fs = require('fs');
const os = require('os');
const path = require('path');
const io = require('@actions/io');
const core = require('@actions/core');
const tc = require('@actions/tool-cache');
const { execSync } = require("child_process");

const urls = {
  'linux': 'https://releases.stackql.io/stackql/latest/stackql_linux_amd64.zip',
  'darwin': 'https://storage.googleapis.com/stackql-public-releases/latest/stackql_darwin_multiarch.pkg',
  'win32': 'https://releases.stackql.io/stackql/latest/stackql_windows_amd64.zip',
}

async function downloadCLI(osPlatform){
  try {

    core.info(`downloading stackql binary for ${osPlatform}`);
    const url = urls[osPlatform]
    core.debug(`binary location: ${url}`);

    // let pathToCLI = '';

    switch (osPlatform) {
      case 'win32':
        // const pathToWinZip = await tc.downloadTool(url);
        // return await tc.extractZip(pathToWinZip);
        return await tc.extractZip(await tc.downloadTool(url));
        
        // pathToCLI = await tc.extractZip(pathToWinZip);
        // return pathToCLI;
      case 'darwin':
        // const pathToMacPkg = await tc.downloadTool(url);
        // return await tc.extractXar(pathToMacPkg);
        return await tc.extractXar(await tc.downloadTool(url));

        // pathToCLI = await tc.extractXar(pathToMacPkg);
        // core.debug(`path to cli: ${pathToCLI}`);
        // fs.chmodSync(pathToCLI, '777');
        // return pathToCLI;
      case 'linux':
        // const pathToLinuxZip = await tc.downloadTool(url);
        // return await tc.extractZip(pathToLinuxZip);
        return await tc.extractZip(await tc.downloadTool(url));

        // pathToCLI = await tc.extractZip(pathToLinuxZip);
        // core.debug(`path to cli: ${pathToCLI}`);
        // fs.chmodSync(pathToCLI, '777');
        // return pathToCLI;
      default:
        throw new Error(`Unsupported platform: ${osPlatform}`);
    }

  } catch (error) {
    core.error(error);
    throw error;
  }
}

async function makeExecutable(path, osPlatform){
  try {
    if(osPlatform === 'win32'){
      return;
    } else {
      core.debug(`making ${path} executable...`);      
      execSync(`chmod +x ${path}`);
      // execSync("find ~ -name stackql -exec chmod +x {} \\;");
    }
    core.debug(`successfully made ${path} executable`);
  } catch (error) {
    core.error(`Error: ${error.message}`);
  }
}

async function installWrapper(path) {
  let source, target;

  // If we're on Windows, then the executable ends with .exe
  const exeSuffix = os.platform().startsWith('win') ? '.exe' : '';

  // Rename stackql(.exe) to stackql-bin(.exe)
  try {
    source = [path, `stackql${exeSuffix}`].join(path.sep);
    target = [path, `stackql-bin${exeSuffix}`].join(path.sep);
    core.debug(`Moving ${source} to ${target}.`);
    await io.mv(source, target);
  } catch (e) {
    core.debug(`Unable to move ${source} to ${target}.`);
    throw e;
  }

  // Install our wrapper as stackql by moving the wrapped executable to stackql
  try {
    source = path.resolve([__dirname, '..', 'wrapper', 'dist', 'index.js'].join(path.sep));
    target = [path, 'stackql'].join(path.sep);
    core.debug(`Copying ${source} to ${target}.`);
    await io.cp(source, target);
  } catch (e) {
    core.error(`Unable to copy ${source} to ${target}.`);
    throw e;
  }

  // Export a new environment variable, so our wrapper can locate the binary
  core.exportVariable('STACKQL_CLI_PATH', path);
}


async function setup(){

  const osPlatform = os.platform();
  const osArch = os.arch();
  core.debug(`platform: ${osPlatform}`);
  core.debug(`arch: ${osArch}`);

  const path = await downloadCLI(osPlatform)
  core.debug(`path to cli: ${path}`);
  fs.chmodSync(path, '777');
  core.addPath(path)
  await makeExecutable(path, osPlatform)
  const wrapper = core.getInput('use_wrapper') === 'true';
  if(wrapper){
    core.debug('installing wrapper')
    await installWrapper(path)
  }
  core.info(`successfully setup stackql at ${path}`);
}

(async () => {
    try {
      await setup();
    } catch (error) {
      core.setFailed(error.message);
    }
  })();
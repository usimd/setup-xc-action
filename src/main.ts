import * as core from '@actions/core'
import * as tc from '@actions/tool-cache'
import * as exec from '@actions/exec'
import * as path from 'path'
import * as fs from 'fs'

const COMPILER_BASE_URL =
  'https://ww1.microchip.com/downloads/aemDocuments/documents/DEV/ProductDocuments/SoftwareTools'

// Required 32-bit libraries for 64-bit systems
// Source: https://developerhelp.microchip.com/xwiki/bin/view/software-tools/ides/x/archive/linux/
const REQUIRED_PACKAGES = [
  'libc6:i386',
  'libx11-6:i386',
  'libxext6:i386',
  'libstdc++6:i386',
  'libexpat1:i386'
]

/**
 * Checks if a package is installed
 */
export async function isPackageInstalled(packageName: string): Promise<boolean> {
  try {
    const result = await exec.getExecOutput('dpkg', ['-l', packageName], {
      silent: true,
      ignoreReturnCode: true
    })
    return result.exitCode === 0 && result.stdout.includes('ii')
  } catch {
    return false
  }
}

/**
 * Installs required 32-bit prerequisites for 64-bit systems
 * Required for Microchip XC compilers on Ubuntu 64-bit
 */
export async function installPrerequisites(): Promise<void> {
  core.info('Checking for required 32-bit libraries...')

  const missingPackages: string[] = []
  for (const pkg of REQUIRED_PACKAGES) {
    const installed = await isPackageInstalled(pkg)
    if (!installed) {
      missingPackages.push(pkg)
    }
  }

  if (missingPackages.length === 0) {
    core.info('✅ All required packages are already installed')
    return
  }

  core.info(`Installing missing packages: ${missingPackages.join(', ')}`)

  try {
    // Enable i386 architecture if not already enabled
    core.info('Enabling i386 architecture...')
    await exec.exec('sudo', ['dpkg', '--add-architecture', 'i386'], { silent: true })

    // Update package lists
    core.info('Updating package lists...')
    await exec.exec('sudo', ['apt-get', 'update', '-qq'], { silent: true })

    // Install missing packages
    core.info('Installing 32-bit prerequisites...')
    await exec.exec('sudo', ['apt-get', 'install', '-y', '-qq', ...missingPackages], {
      silent: false
    })

    core.info('✅ Prerequisites installed successfully')
  } catch (error) {
    throw new Error(
      `Failed to install prerequisites: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

/**
 * Constructs the download URL for the specified compiler and version
 */
export function getDownloadUrl(compiler: string, version: string): string {
  const compilerLower = compiler.toLowerCase()

  // Format version for URL (e.g., "3.10" -> "v3.10", "2.10" -> "v2.10")
  const versionStr = `v${version}`

  let installerName = ''
  switch (compilerLower) {
    case 'xc8':
      installerName = `xc8-${versionStr}-full-install-linux-x64-installer.run`
      break
    case 'xc16':
      installerName = `xc16-${versionStr}-full-install-linux64-installer.run`
      break
    case 'xc32':
      installerName = `xc32-${versionStr}-full-install-linux-x64-installer.run`
      break
    default:
      throw new Error(`Unsupported compiler: ${compiler}. Must be one of: xc8, xc16, xc32`)
  }

  return `${COMPILER_BASE_URL}/${installerName}`
}

/**
 * Gets the expected installation path for the compiler
 */
export function getCompilerPath(installDir: string, compiler: string, version: string): string {
  const compilerLower = compiler.toLowerCase()
  return path.join(installDir, compilerLower, `v${version}`)
}

/**
 * Gets the bin directory path for the compiler
 */
export function getBinPath(compilerPath: string): string {
  return path.join(compilerPath, 'bin')
}

/**
 * Main action execution
 */
export async function run(): Promise<void> {
  try {
    // Get inputs
    const compiler = core.getInput('compiler', { required: true })
    const version = core.getInput('version', { required: true })
    const installDir = core.getInput('install-dir') || '/opt/microchip'

    core.info(`Setting up ${compiler} version ${version}`)
    core.info(`Installation directory: ${installDir}`)

    // Validate compiler type
    const validCompilers = ['xc8', 'xc16', 'xc32']
    if (!validCompilers.includes(compiler.toLowerCase())) {
      throw new Error(
        `Invalid compiler type: ${compiler}. Must be one of: ${validCompilers.join(', ')}`
      )
    }

    // Check if compiler is already cached in tool cache
    const cachedPath = tc.find(compiler, version)
    if (cachedPath) {
      core.info(`Found cached compiler at ${cachedPath}`)
      const binPath = getBinPath(cachedPath)

      // Add to PATH
      core.addPath(binPath)

      // Set outputs
      core.setOutput('install-dir', cachedPath)
      core.setOutput('compiler-path', binPath)

      core.info(`✅ ${compiler} v${version} is ready (from cache)`)
      return
    }

    // Install prerequisites for 64-bit systems
    await installPrerequisites()

    // Get download URL
    const downloadUrl = getDownloadUrl(compiler, version)
    core.info(`Download URL: ${downloadUrl}`)

    // Download the installer
    core.info('Downloading installer...')
    let installerPath: string
    try {
      installerPath = await tc.downloadTool(downloadUrl)
      core.info(`Downloaded to: ${installerPath}`)
    } catch (error) {
      throw new Error(
        `Failed to download installer from ${downloadUrl}. ` +
          `Please verify that version ${version} exists for ${compiler}. ` +
          `Error: ${error instanceof Error ? error.message : String(error)}`
      )
    }

    // Make installer executable
    await exec.exec('chmod', ['+x', installerPath])

    // Prepare installation directory
    const compilerPath = getCompilerPath(installDir, compiler, version)
    core.info(`Installing to: ${compilerPath}`)

    // Create installation directory if it doesn't exist
    if (!fs.existsSync(installDir)) {
      fs.mkdirSync(installDir, { recursive: true })
    }

    // Run the installer in unattended mode
    // Microchip installers support --mode unattended and --prefix for installation path
    core.info('Running installer...')
    const installOptions = {
      silent: false,
      ignoreReturnCode: false
    }

    try {
      await exec.exec(
        installerPath,
        ['--mode', 'unattended', '--netservername', 'localhost', '--prefix', compilerPath],
        installOptions
      )
    } catch (error) {
      throw new Error(
        `Installation failed. The installer may require sudo privileges or ` +
          `the version may not be available. Error: ${error instanceof Error ? error.message : String(error)}`
      )
    }

    core.info('Installation completed')

    // Verify installation
    const binPath = getBinPath(compilerPath)
    if (!fs.existsSync(binPath)) {
      throw new Error(`Installation verification failed: bin directory not found at ${binPath}`)
    }

    // Cache the installed compiler for future runs
    core.info('Caching compiler for future runs...')
    const cachedToolPath = await tc.cacheDir(compilerPath, compiler, version)
    core.info(`Cached to: ${cachedToolPath}`)

    // Add to PATH
    core.addPath(binPath)
    core.info(`Added ${binPath} to PATH`)

    // Set outputs
    core.setOutput('install-dir', compilerPath)
    core.setOutput('compiler-path', binPath)

    core.info(`✅ ${compiler} v${version} installed successfully!`)
    core.info(`   Install directory: ${compilerPath}`)
    core.info(`   Binary path: ${binPath}`)
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message)
    } else {
      core.setFailed(String(error))
    }
  }
}

// Only run if this file is being executed directly (not imported for testing)
if (require.main === module) {
  run()
}

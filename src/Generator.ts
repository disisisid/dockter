import Doer from './Doer'
import { SoftwareEnvironment, SoftwarePackage } from './context'

const VERSION = require('../package').version

/**
 * Generates a Dockerfile for a `SoftwareEnvironment` instance
 */
export default class Generator extends Doer {

  environ: SoftwareEnvironment

  constructor (environ: SoftwareEnvironment, folder?: string) {
    super(folder)
    this.environ = environ
  }

  /**
   * Generate a Dockerfile for a `SoftwareEnvironment` instance
   *
   * @param header Should a header message be added to the Dockerfile?
   */
  generate (header: boolean = true): string {
    let dockerfile = ''

    if (header) {
      dockerfile += `# Generated by Dockter ${VERSION} at ${new Date().toISOString()}
# To stop Dockter generating this file and start editing it yourself, rename it to "Dockerfile".\n\n`
    }

    const baseIdentifier = this.baseIdentifier()
    dockerfile += `FROM ${baseIdentifier}\n`

    if (!this.applies()) return dockerfile

    const envVars = this.envVars(this.baseVersion())
    if (envVars.length) {
      const pairs = envVars.map(([key, value]) => `${key}="${value.replace('"', '\\"')}"`)
      dockerfile += `\nENV ${pairs.join(' \\\n    ')}\n`
    }

    const aptRepos: Array<[string, string]> = this.aptRepos(this.baseVersion())
    if (aptRepos.length) {
      // Install system packages required for adding repos
      dockerfile += `
RUN apt-get update \\
 && DEBIAN_FRONTEND=noninteractive apt-get install -y \\
      apt-transport-https \\
      ca-certificates \\
      software-properties-common
`

      // Add each repository and fetch signing key if defined
      for (let [deb, key] of aptRepos) {
        dockerfile += `\nRUN apt-add-repository "${deb}"${key ? ` \\\n && apt-key adv --keyserver keyserver.ubuntu.com --recv-keys ${key}` : ''}\n`
      }
    }

    let aptPackages: Array<string> = this.aptPackages(baseIdentifier)
    if (aptPackages.length) {
      dockerfile += `
RUN apt-get update \\
 && DEBIAN_FRONTEND=noninteractive apt-get install -y \\
      ${aptPackages.join(' \\\n      ')} \\
 && apt-get autoremove -y \\
 && apt-get clean \\
 && rm -rf /var/lib/apt/lists/*
`
    }

    // Once everything that needs root permissions is installed, switch the user to non-root for installing the rest of the packages.
    dockerfile += `
RUN useradd --create-home --uid 1001 -s /bin/bash dockteruser
USER dockteruser
WORKDIR /home/dockteruser
`

    const installFiles = this.installFiles(baseIdentifier)
    const installCommand = this.installCommand(baseIdentifier)
    const projectFiles = this.projectFiles(baseIdentifier)
    const runCommand = this.runCommand(baseIdentifier)

    // Add Dockter special comment for managed installation of language packages
    if (installCommand) {
      dockerfile += `\n# dockter\n`
    }

    // Copy files needed for installation of language packages
    if (installFiles.length) {
      for (let [src, dest] of installFiles) {
        dockerfile += `\nCOPY ${src} ${dest}\n`
      }
    }

    // Run command to install packages
    if (installCommand) {
      dockerfile += `RUN ${installCommand}\n`
    }

    // Copy files needed to run project
    if (projectFiles.length) {
      dockerfile += '\n' + projectFiles.map(([src, dest]) => `COPY ${src} ${dest}`).join('\n') + '\n'
    }

    // Add any CMD
    if (runCommand) {
      dockerfile += `\nCMD ${runCommand}\n`
    }

    // Write `.Dockerfile` for use by Docker
    this.write('.Dockerfile', dockerfile)

    return dockerfile
  }

  // Methods that are overridden in derived classes

  /**
   * Get a list of packages in `this.environ.softwareRequirements`
   * which have have a particular `runtimePlatform` value
   */
  filterPackages (runtimePlatform: string): Array<SoftwarePackage> {
    if (this.environ.softwareRequirements) {
      return this.environ.softwareRequirements
          .filter(req => (req as SoftwarePackage).runtimePlatform === runtimePlatform)
          .map(req => req as SoftwarePackage)
    }
    return []
  }

  applies (): boolean {
    return this.filterPackages(this.appliesRuntime()).length > 0
  }

  appliesRuntime (): string {
    return 'deb'
  }

  baseName (): string {
    return 'ubuntu'
  }

  baseVersion (): string {
    return '18.04'
  }

  baseIdentifier (): string {
    const joiner = this.baseVersion() === '' ? '' : ':'

    return `${this.baseName()}${joiner}${this.baseVersion()}`
  }

  sysVersionName (sysVersion: string): string {
    const lookup: { [key: string]: string } = {
      '14.04': 'trusty',
      '16.04': 'xenial',
      '18.04': 'bionic'
    }
    return lookup[sysVersion]
  }

  envVars (sysVersion: string): Array<[string, string]> {
    return []
  }

  aptRepos (sysVersion: string): Array<[string, string]> {
    return []
  }

  aptPackages (sysVersion: string): Array<string> {
    return this.filterPackages('deb').map(pkg => pkg.name || '')
  }

  /**
   * A list of files that need to be be copied
   * into the image before running `installCommand`
   *
   * @param sysVersion The Ubuntu system version being used
   * @returns An array of [src, dest] tuples
   */
  installFiles (sysVersion: string): Array<[string, string]> {
    return []
  }

  /**
   * The Bash command to run to install required language packages
   *
   * @param sysVersion The Ubuntu system version being used
   */
  installCommand (sysVersion: string): string | undefined {
    return
  }

  /**
   * The project's files that should be copied across to the image
   *
   * @param sysVersion The Ubuntu system version being used
   * @returns An array of [src, dest] tuples
   */
  projectFiles (sysVersion: string): Array<[string, string]> {
    return []
  }

  /**
   * The default command to run containers created from this image
   *
   * @param sysVersion The Ubuntu system version being used
   */
  runCommand (sysVersion: string): string | undefined {
    return
  }
}

# Setup Microchip XC Compiler Action

A GitHub Action to download and install Microchip XC compilers (xc8, xc16, xc32) for Linux on GitHub Actions Ubuntu runners. This action utilizes the GitHub Actions toolkit's tool cache feature for efficient caching and faster subsequent runs.

## Features

- 🚀 Automatic download and installation of Microchip XC compilers
- 💾 Built-in caching using GitHub Actions tool cache
- 🎯 Support for xc8, xc16, and xc32 compilers
- 📌 Version pinning for reproducible builds
- 🔧 Configurable installation directory
- 📤 Outputs installation paths for downstream jobs
- 🛠️ Automatic installation of required 32-bit libraries for 64-bit systems

## Supported Compilers

- **XC8**: C compiler for 8-bit PIC and AVR microcontrollers
- **XC16**: C compiler for 16-bit PIC microcontrollers and dsPIC DSCs
- **XC32**: C/C++ compiler for 32-bit PIC and SAM microcontrollers

## Usage

### Basic Example

```yaml
steps:
  - uses: actions/checkout@v4
  
  - name: Setup XC8 Compiler
    uses: usimd/setup-xc-action@v1
    with:
      compiler: 'xc8'
      version: '3.10'
  
  - name: Build with XC8
    run: |
      xc8 --version
      # Your build commands here
```

### Installing Multiple Compilers

```yaml
steps:
  - uses: actions/checkout@v4
  
  - name: Setup XC8
    uses: usimd/setup-xc-action@v1
    with:
      compiler: 'xc8'
      version: '3.10'
  
  - name: Setup XC16
    uses: usimd/setup-xc-action@v1
    with:
      compiler: 'xc16'
      version: '2.10'
  
  - name: Setup XC32
    uses: usimd/setup-xc-action@v1
    with:
      compiler: 'xc32'
      version: '5.00'
```

### Custom Installation Directory

```yaml
steps:
  - name: Setup XC32
    uses: usimd/setup-xc-action@v1
    with:
      compiler: 'xc32'
      version: '5.00'
      install-dir: '/usr/local/microchip'
```

### Using Outputs

```yaml
steps:
  - name: Setup XC8
    id: setup-xc8
    uses: usimd/setup-xc-action@v1
    with:
      compiler: 'xc8'
      version: '3.10'
  
  - name: Display Installation Info
    run: |
      echo "Installed at: ${{ steps.setup-xc8.outputs.install-dir }}"
      echo "Compiler path: ${{ steps.setup-xc8.outputs.compiler-path }}"
```

### Matrix Build with Multiple Versions

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        compiler: ['xc8', 'xc16', 'xc32']
        include:
          - compiler: 'xc8'
            version: '3.10'
          - compiler: 'xc16'
            version: '2.10'
          - compiler: 'xc32'
            version: '5.00'
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup ${{ matrix.compiler }}
        uses: usimd/setup-xc-action@v1
        with:
          compiler: ${{ matrix.compiler }}
          version: ${{ matrix.version }}
      
      - name: Verify Installation
        run: ${{ matrix.compiler }} --version
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `compiler` | Compiler type to install (`xc8`, `xc16`, or `xc32`) | Yes | - |
| `version` | Compiler version to install (e.g., `3.10`, `2.10`, `5.00`) | Yes | - |
| `install-dir` | Installation directory for the compiler | No | `/opt/microchip` |

## Outputs

| Output | Description |
|--------|-------------|
| `install-dir` | Directory where the compiler was installed |
| `compiler-path` | Full path to the compiler binary directory |

## How It Works

1. **Cache Check**: First checks if the requested compiler version is already cached in the GitHub Actions tool cache
2. **Prerequisites**: Automatically installs required 32-bit libraries on 64-bit systems ([see Microchip documentation](https://developerhelp.microchip.com/xwiki/bin/view/software-tools/ides/x/archive/linux/))
   - libc6:i386
   - libx11-6:i386
   - libxext6:i386
   - libstdc++6:i386
   - libexpat1:i386
3. **Download**: If not cached, downloads the installer from Microchip's official website
4. **Installation**: Runs the installer in unattended mode with the specified installation directory
5. **Caching**: Caches the installed compiler for faster subsequent runs
6. **PATH Update**: Automatically adds the compiler's bin directory to the PATH
7. **Verification**: Verifies the installation was successful

## Troubleshooting

The action supports downloading from official Microchip URLs. Current stable versions:

- **XC8**: v3.10
- **XC16**: v2.10
- **XC32**: v5.00

You can specify any version that follows Microchip's URL pattern. If a version doesn't exist, the action will fail with a clear error message.

## Notes

- This action is designed for Linux runners only (Ubuntu)
- The action uses tool caching to speed up subsequent runs
- Installers are run in unattended mode
- The compiler bin directory is automatically added to PATH
- Installation requires write permissions to the installation directory

## Troubleshooting

### Installation Fails

If the installation fails, verify:
1. The version number is correct and exists on Microchip's website
2. The runner has sufficient disk space
3. The installation directory is writable

### Compiler Not Found After Installation

If the compiler is not found in PATH after installation:
1. Check the action outputs for the correct paths
2. Verify the installation completed successfully
3. Try manually adding the path using the action outputs

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Acknowledgments

- Built with [GitHub Actions Toolkit](https://github.com/actions/toolkit)
- Microchip for providing the XC compilers


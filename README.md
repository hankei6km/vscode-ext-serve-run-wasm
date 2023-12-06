# vscode-ext-serve-run-wasm

Experimental - VS Code extension to serve the ability to run ".wasm" on the terminal

## Features

- Run ".wasm" on the terminal

## Requirements

This extension uses the [WASM WASI Core Extension](https://github.com/microsoft/vscode-wasm), so no external runtime (such as wasmtime) is required.

However, the terminal environment is only supported on Linux (because the client tool is only available for Linux).

## Preparing the client tool

The pre-built binary can be downloaded from the release of the GitHub repository.

todo: ここにダウンロードの詳細を追記。

Alternatively, if you have a Rust environment, you can install it with `cargo install`.

```sh
cargo install --git https://github.com/hankei6km/vscode-ext-serve-run-wasm.git crw
```

## Usage

1. Open the terminal (not the web shell terminal)
1. `$ crw /path/to/file.wasm`

![A screenshot of running a .wasm file using the `crw` command](images/screenshot.png)

### Files PATH

- `.wasm` file executed by `crw`: PATH on the actual file system
- Files accessed by the `.wasm` process: PATH on the file system created by the [WASM WASI Core Extension](https://github.com/microsoft/vscode-wasm)

```sh
# Workspace folder is `/path/to/project`
$ ls /path/to/project
test1.txt test2.txt
# The `.wasm` file is located outside of the Workspace
$ ls /path/to/wasm/bin/file.wasm
file.wasm
# Pass the path on the created file system to `.wasm` process
$ crw run /path/to/wasm/bin/file.wasm /workspace/test1.txt /workspace/test2.txt
```

### MemoryDescriptor

You can specify the memory descriptor via `--memory-*` flags.

An example of executing a `.wasm` file built using [`wasm32-wasi-preview1-threads`](https://doc.rust-lang.org/nightly/rustc/platform-support/wasm32-wasi-preview1-threads.html) target.

```sh
crw --memory-initial=20 --memory-maximum=160 -- /path/to/file.wasm
```

If you want to disable shared memory, you can use `--memory-shared=false` flag.

```sh
crw --memory-initial=20 --memory-shared=false -- /path/to/file.wasm
```

## stdin

In the current state, the `.wasm` process started with the [WASM WASI Core Extension](https://github.com/microsoft/vscode-wasm) does not have a stable `stdin`.

Therefore, by default, this extension does not write data that is readed from the client tool's `stdin` to the `.wasm` process.

The `--force-exit-after-n-seconds-stdin-is-closed` flag allows writing data to the process.

```sh
$ seq 1000 | sha256sum
67d4ff71d43921d5739f387da09746f405e425b07d727e4c69d029461d1f051f  -
$ seq 1000 | crw run --force-exit-after-n-seconds-stdin-is-closed 5 chk1.wasm pipe | sha256sum
67d4ff71d43921d5739f387da09746f405e425b07d727e4c69d029461d1f051f  -
```

However, there are also disadvantages to forcibly terminating the process.

```sh
# The process cannot complete flushing the data.
$ seq 1000 | tr '\n' : | crw run --force-exit-after-n-seconds-stdin-is-closed 5 chk1.wasm pipe | tail -c 20
791:792:793:794:795:

# It often results in an error because it is forcibly terminated.
$ echo test | crw run --force-exit-after-n-seconds-stdin-is-closed 5 chk1.wasm pipe
test
$ echo $?
1
```

> [!WARNING]
>
> No `pty` is created for the `.wasm` process. This is a limitation of this extension.

use std::env;
use std::path::PathBuf;
use std::process::{Command, ExitCode, Stdio};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

fn find_java() -> Option<PathBuf> {
    if let Ok(exe_path) = env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            // Bundled JRE: <exe_dir>/jre/bin/java (Windows NSIS layout)
            let bundled = exe_dir.join("jre").join("bin").join("java.exe");
            if bundled.exists() {
                return Some(bundled);
            }
            // Fallback: <exe_dir>/resources/jre/bin/java (if Tauri nests resources)
            let bundled_alt = exe_dir
                .join("resources")
                .join("jre")
                .join("bin")
                .join("java.exe");
            if bundled_alt.exists() {
                return Some(bundled_alt);
            }
        }
    }

    // JAVA_HOME environment variable
    if let Ok(java_home) = env::var("JAVA_HOME") {
        let java = PathBuf::from(&java_home).join("bin").join("java.exe");
        if java.exists() {
            return Some(java);
        }
    }

    // java on PATH
    let mut check = Command::new("java");
    check
        .arg("-version")
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    #[cfg(windows)]
    check.creation_flags(CREATE_NO_WINDOW);

    if check.status().is_ok() {
        return Some(PathBuf::from("java"));
    }

    None
}

fn main() -> ExitCode {
    let args: Vec<String> = env::args().skip(1).collect();

    let java_path = match find_java() {
        Some(path) => path,
        None => {
            println!(r#"{{"event":"error","message":"Java runtime not found"}}"#);
            return ExitCode::from(1);
        }
    };

    let mut cmd = Command::new(&java_path);
    cmd.args(&args)
        .stdin(Stdio::inherit())
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit());

    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);

    match cmd.status() {
        Ok(exit) => ExitCode::from(exit.code().unwrap_or(1) as u8),
        Err(e) => {
            let msg = e.to_string().replace('"', r#"\""#);
            println!(r#"{{"event":"error","message":"Failed to start Java: {msg}"}}"#);
            ExitCode::from(1)
        }
    }
}

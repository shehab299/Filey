use std::{env, fs, io, path::PathBuf};

const ROOT_KEY: &str = "ROOT";
const DEFAULT_ROOT: &str = "./assets";

pub fn load() -> io::Result<()> {
    match dotenvy::dotenv() {
        Ok(_) => Ok(()),
        Err(dotenvy::Error::Io(e)) if e.kind() == io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(io::Error::other(e)),
    }
}

pub fn root() -> io::Result<PathBuf> {
    let raw = env::var(ROOT_KEY).unwrap_or_else(|_| DEFAULT_ROOT.to_string());
    let path = PathBuf::from(&raw);

    let meta = fs::metadata(&path).map_err(|_| {
        io::Error::new(
            io::ErrorKind::NotFound,
            format!("root directory '{}' does not exist", path.display()),
        )
    })?;

    if !meta.is_dir() {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            format!("root '{}' is not a directory", path.display()),
        ));
    }

    path.canonicalize()
}

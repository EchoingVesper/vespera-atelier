fn main() {
    // Configure builds based on enabled features
    
    #[cfg(feature = "nodejs")]
    {
        napi_build::setup();
    }
    
    #[cfg(feature = "python")]
    {
        pyo3_build_config::add_extension_module_link_args();
    }
    
    // Generate build info for debugging
    println!("cargo:rustc-env=BUILD_TARGET={}", std::env::var("TARGET").unwrap_or_else(|_| "unknown".to_string()));
    println!("cargo:rustc-env=BUILD_PROFILE={}", std::env::var("PROFILE").unwrap_or_else(|_| "unknown".to_string()));
    
    // Rerun if these files change
    println!("cargo:rerun-if-changed=Cargo.toml");
    println!("cargo:rerun-if-changed=build.rs");
    println!("cargo:rerun-if-changed=src/");
}
// Debug test to understand Entry behavior

use keyring::Entry;

#[test]
fn test_entry_creation_and_usage() {
    let service = "test-service";
    let username = "test/key";
    let password = "test-value";

    println!("=== Entry Debug Test ===");
    println!("Service: {}", service);
    println!("Username: {}", username);
    println!("Password: {}", password);

    // Create entry
    println!("\n1. Creating Entry...");
    let entry = match Entry::new(service, username) {
        Ok(e) => {
            println!("   ✓ Entry created successfully");
            e
        }
        Err(e) => {
            println!("   ✗ Entry creation failed: {}", e);
            panic!("Cannot continue without entry");
        }
    };

    // Store password
    println!("\n2. Setting password...");
    match entry.set_password(password) {
        Ok(()) => println!("   ✓ Password set successfully"),
        Err(e) => {
            println!("   ✗ Set password failed: {}", e);
            panic!("Cannot continue without setting password");
        }
    }

    // Create new entry instance with same parameters
    println!("\n3. Creating new Entry instance (same service/username)...");
    let entry2 = match Entry::new(service, username) {
        Ok(e) => {
            println!("   ✓ Second entry created successfully");
            e
        }
        Err(e) => {
            println!("   ✗ Second entry creation failed: {}", e);
            panic!("Cannot continue");
        }
    };

    // Try to retrieve password using second instance
    println!("\n4. Getting password from second Entry instance...");
    match entry2.get_password() {
        Ok(retrieved) => {
            println!("   ✓ Password retrieved: '{}'", retrieved);
            assert_eq!(retrieved, password, "Password should match");
        }
        Err(e) => {
            println!("   ✗ Get password failed: {}", e);
            println!("   ERROR: This is the problem - can't retrieve from new Entry instance!");
        }
    }

    // Clean up
    println!("\n5. Deleting credential...");
    match entry.delete_credential() {
        Ok(()) => println!("   ✓ Credential deleted"),
        Err(e) => println!("   ℹ Delete failed: {} (might not exist)", e),
    }

    println!("\n=== Test complete ===");
}

// Diagnostic test to understand keyring behavior

use anyhow::Result;
use vespera_bindery::secrets::KeyringBackend;
use vespera_bindery::secrets::SecretBackend;

#[tokio::test]
async fn test_diagnostic_keyring_operations() -> Result<()> {
    let backend = KeyringBackend::new("vespera-diagnostic")?;

    println!("=== Testing Keyring Operations ===");
    println!("Backend name: {}", backend.backend_name());
    println!("Backend available: {}", backend.is_available().await);

    let test_key = "diagnostic/test_key";
    let test_value = "diagnostic-value-123";

    // Test 1: Store
    println!("\n1. Storing secret...");
    match backend.store_secret(test_key, test_value).await {
        Ok(()) => println!("   ✓ Store succeeded"),
        Err(e) => {
            println!("   ✗ Store failed: {}", e);
            return Err(e);
        }
    }

    // Test 2: Retrieve immediately after store
    println!("\n2. Retrieving secret...");
    match backend.get_secret(test_key).await {
        Ok(value) => {
            println!("   ✓ Retrieved: '{}'", value);
            assert_eq!(value, test_value, "Retrieved value should match stored value");
        }
        Err(e) => {
            println!("   ✗ Retrieval failed: {}", e);
            println!("   (This means store might have failed or lookup is wrong)");
            return Err(e);
        }
    }

    // Test 3: Update (overwrite) existing secret
    println!("\n3. Updating secret...");
    let new_value = "updated-diagnostic-value-456";
    match backend.store_secret(test_key, new_value).await {
        Ok(()) => println!("   ✓ Update succeeded"),
        Err(e) => {
            println!("   ✗ Update failed: {}", e);
            return Err(e);
        }
    }

    // Test 4: Retrieve updated value
    println!("\n4. Retrieving updated secret...");
    match backend.get_secret(test_key).await {
        Ok(value) => {
            println!("   ✓ Retrieved updated value: '{}'", value);
            assert_eq!(value, new_value, "Retrieved value should match updated value");
        }
        Err(e) => {
            println!("   ✗ Retrieval of updated value failed: {}", e);
            return Err(e);
        }
    }

    // Test 5: Delete
    println!("\n5. Deleting secret...");
    match backend.delete_secret(test_key).await {
        Ok(()) => println!("   ✓ Delete succeeded"),
        Err(e) => {
            println!("   ✗ Delete failed: {}", e);
            println!("   (Note: This might fail if the entry doesn't exist)");
            // Don't return error here, continue to test retrieval
        }
    }

    // Test 6: Try to retrieve deleted secret
    println!("\n6. Trying to retrieve deleted secret (should fail)...");
    match backend.get_secret(test_key).await {
        Ok(value) => {
            println!("   ✗ Unexpectedly retrieved value: '{}' (secret should be deleted!)", value);
            anyhow::bail!("Secret should not exist after deletion");
        }
        Err(e) => {
            println!("   ✓ Retrieval correctly failed: {}", e);
        }
    }

    // Test 7: Try to delete non-existent secret
    println!("\n7. Trying to delete non-existent secret...");
    match backend.delete_secret("nonexistent/key").await {
        Ok(()) => println!("   ✓ Delete of non-existent secret succeeded (backend is lenient)"),
        Err(e) => println!("   ℹ Delete of non-existent secret failed: {} (this is OK)", e),
    }

    println!("\n=== All diagnostic tests passed! ===");
    Ok(())
}

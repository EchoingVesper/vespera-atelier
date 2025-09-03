# User Security Guide

**Version**: 1.0  
**Date**: September 2025  
**Status**: User Ready  

## 📋 Overview

This guide helps you understand and manage the security features in Vespera Forge, including privacy controls, consent management, and security settings. These features are designed to protect your data while providing a seamless development experience.

## 🛡️ Security Features Overview

Vespera Forge includes enterprise-grade security features that work automatically to protect you:

### 🚦 Rate Limiting
- **What it does**: Prevents abuse and protects against excessive resource usage
- **How it helps**: Ensures fair usage and prevents the extension from overwhelming your system
- **User impact**: Minimal - you may occasionally see brief delays during heavy usage

### ✅ Privacy & Consent Management
- **What it does**: Gives you control over what data the extension can collect and use
- **How it helps**: Ensures GDPR compliance and respects your privacy preferences  
- **User impact**: Periodic consent requests for optional features

### 🛡️ Input Protection
- **What it does**: Automatically scans and cleans potentially dangerous content
- **How it helps**: Protects against malicious code and security threats
- **User impact**: Invisible protection - content is cleaned automatically

### 📊 Security Monitoring
- **What it does**: Tracks security events and provides audit trails
- **How it helps**: Enables compliance and helps detect potential issues
- **User impact**: Background monitoring with optional security notifications

## 🔒 Privacy and Consent Management

### Understanding Consent Categories

When you first use Vespera Forge, you'll be asked about different types of data usage:

#### Essential Functionality (Required)
- **Purpose**: Core extension features like commands and UI
- **Data**: Commands you run, error logs, basic usage
- **Legal basis**: Legitimate interests (required for the extension to work)
- **Your control**: Cannot be disabled (essential for functionality)

#### Usage Analytics (Optional)
- **Purpose**: Help improve the extension through usage statistics
- **Data**: Feature usage, performance metrics, aggregated statistics  
- **Legal basis**: Your consent
- **Your control**: Can grant, deny, or withdraw at any time

#### Error Reporting (Optional)
- **Purpose**: Automatically report errors to help fix bugs
- **Data**: Error messages, stack traces, system information
- **Legal basis**: Your consent
- **Your control**: Can grant, deny, or withdraw at any time

#### Personalization (Optional)
- **Purpose**: Customize the extension based on your preferences
- **Data**: Settings, usage patterns, customization choices
- **Legal basis**: Your consent
- **Your control**: Can grant, deny, or withdraw at any time

#### Chat History (Optional)
- **Purpose**: Store chat conversations for context and continuity
- **Data**: Chat messages, conversation history
- **Legal basis**: Your consent
- **Your control**: Can grant, deny, or withdraw at any time

### Managing Your Consent

#### Initial Consent Dialog

When you first use features that require consent, you'll see a privacy dialog like this:

```
┌─ Vespera Forge Privacy Consent ─────────────────────┐
│                                                     │
│ We need your permission to use these features:     │
│                                                     │
│ ☐ Usage Analytics                                   │
│   Help improve the extension (recommended)          │
│   Data: Feature usage, performance metrics          │
│   Retention: 2 years                               │
│                                                     │
│ ☐ Error Reporting                                   │
│   Automatically report errors for faster fixes     │
│   Data: Error messages, system info                │
│   Retention: 90 days                               │
│                                                     │
│ [ Accept Selected ]  [ Decline All ]  [ Learn More ] │
└─────────────────────────────────────────────────────┘
```

#### Managing Consent Settings

You can change your consent preferences at any time:

1. **Via Command Palette**:
   - Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac)
   - Type "Vespera: Privacy Settings"
   - Select the command

2. **Via Settings**:
   - Go to VS Code Settings (`Ctrl+,`)
   - Search for "Vespera Privacy"
   - Adjust your preferences

3. **Via Status Bar** (if enabled):
   - Look for the privacy icon in the status bar
   - Click to open privacy controls

#### Privacy Dashboard

The privacy dashboard shows your current consent status:

```
Vespera Forge Privacy Dashboard
════════════════════════════════

Current Consent Status:
✅ Essential Functionality    (Required - Cannot be disabled)
✅ Usage Analytics           Granted on: Sept 3, 2025
❌ Error Reporting           Not granted
✅ Personalization          Granted on: Sept 3, 2025
❌ Chat History             Not granted

Data Summary:
• Total data collected: Minimal (with your consent)
• Data retention: According to category policies
• Your rights: View, export, or delete your data anytime

[Manage Consent]  [Export My Data]  [Delete My Data]
```

### Your Privacy Rights

Under GDPR and privacy regulations, you have several rights:

#### Right to be Informed
- **What**: Clear information about data collection
- **How**: This guide and consent dialogs explain everything
- **Action**: Read privacy information before making decisions

#### Right of Access
- **What**: See what data we have about you
- **How**: Use the "Export My Data" feature
- **Action**: Click "Export My Data" in privacy settings

#### Right to Rectification
- **What**: Correct inaccurate data
- **How**: Contact support or update your preferences
- **Action**: Use settings or contact support

#### Right to Erasure (Right to be Forgotten)
- **What**: Delete your personal data
- **How**: Use the "Delete My Data" feature
- **Action**: Click "Delete My Data" in privacy settings

#### Right to Data Portability
- **What**: Get your data in a machine-readable format
- **How**: Use the "Export My Data" feature
- **Action**: Downloads JSON file with all your data

#### Right to Withdraw Consent
- **What**: Change your mind about data usage
- **How**: Uncheck boxes in privacy settings
- **Action**: Changes take effect immediately

### Data Export and Deletion

#### Exporting Your Data

To export all your data:

1. Open privacy settings (`Ctrl+Shift+P` → "Vespera: Privacy Settings")
2. Click "Export My Data"
3. Choose export location
4. Download includes:
   - All consent records with timestamps
   - Settings and preferences
   - Usage data (if consented)
   - Chat history (if consented)

Export format example:
```json
{
  "userId": "user-123",
  "exportDate": "2025-09-03T12:00:00Z",
  "consentRecords": [
    {
      "purposeId": "usage-analytics",
      "granted": true,
      "timestamp": "2025-09-03T10:00:00Z",
      "evidence": {
        "method": "UI_DIALOG",
        "consentString": "I agree to usage analytics"
      }
    }
  ],
  "userData": {
    "preferences": {...},
    "chatHistory": [...],
    "usageMetrics": [...]
  }
}
```

#### Deleting Your Data

To delete all your data:

1. Open privacy settings
2. Click "Delete My Data"
3. Confirm deletion (this cannot be undone)
4. All data is permanently removed within 24 hours

**Important**: Deleting your data will:
- Remove all personalization settings
- Clear chat history
- Reset the extension to default state
- Cannot be undone

## 🔧 Security Settings

### Accessing Security Settings

Security settings are available in several places:

1. **VS Code Settings**:
   ```
   File → Preferences → Settings → Extensions → Vespera Forge → Security
   ```

2. **Command Palette**:
   ```
   Ctrl+Shift+P → "Vespera: Security Settings"
   ```

3. **Extension Settings Panel** (if available)

### Available Security Settings

#### Core Security Settings

```json
{
  "vesperaForge.security.enabled": true,
  "vesperaForge.security.strictMode": false,
  "vesperaForge.security.notifications": "important"
}
```

- **Security Enabled**: Master switch for all security features
- **Strict Mode**: Enhanced security with stricter validation
- **Notifications**: Control security notification frequency
  - `"all"`: All security events
  - `"important"`: Only important events (default)
  - `"critical"`: Only critical security events
  - `"none"`: No security notifications

#### Privacy Settings

```json
{
  "vesperaForge.privacy.showConsentDialog": true,
  "vesperaForge.privacy.dataRetention": "standard",
  "vesperaForge.privacy.statusBarIndicator": true
}
```

- **Show Consent Dialog**: Display consent requests for new features
- **Data Retention**: How long to keep data (`"minimal"`, `"standard"`, `"extended"`)
- **Status Bar Indicator**: Show privacy status in VS Code status bar

#### Input Sanitization Settings

```json
{
  "vesperaForge.sanitization.level": "standard",
  "vesperaForge.sanitization.blockSuspiciousContent": true,
  "vesperaForge.sanitization.notifyOnThreats": true
}
```

- **Sanitization Level**: 
  - `"minimal"`: Basic protection
  - `"standard"`: Recommended protection (default)
  - `"strict"`: Maximum protection
- **Block Suspicious Content**: Automatically block potentially dangerous content
- **Notify on Threats**: Show notifications when threats are detected

#### Rate Limiting Settings

```json
{
  "vesperaForge.rateLimiting.enabled": true,
  "vesperaForge.rateLimiting.notifyOnLimits": false
}
```

- **Enabled**: Enable rate limiting protection
- **Notify on Limits**: Show notifications when rate limits are hit

### Security Notifications

You may occasionally see security notifications:

#### Information Notifications
```
ℹ️ Vespera Security: Input sanitization cleaned potentially unsafe content.
```
- **When**: Content was automatically cleaned
- **Action**: Usually none required
- **Meaning**: The security system is working correctly

#### Warning Notifications
```
⚠️ Vespera Security: Rate limit exceeded. Please wait 30 seconds before retrying.
```
- **When**: You're performing actions too quickly
- **Action**: Wait the specified time
- **Meaning**: Normal protection against excessive usage

#### Critical Notifications
```
🚨 Vespera Security: Critical security threat detected and blocked.
```
- **When**: Serious security threat was found
- **Action**: Review your inputs and sources
- **Meaning**: You may have encountered malicious content

### Customizing Your Security Experience

#### For Privacy-Conscious Users

Maximum privacy configuration:
```json
{
  "vesperaForge.security.enabled": true,
  "vesperaForge.security.strictMode": true,
  "vesperaForge.privacy.dataRetention": "minimal",
  "vesperaForge.sanitization.level": "strict",
  "vesperaForge.security.notifications": "all"
}
```

Set consent to deny all optional features:
- ❌ Usage Analytics
- ❌ Error Reporting  
- ❌ Personalization
- ❌ Chat History

#### For Maximum Functionality

Balanced functionality configuration:
```json
{
  "vesperaForge.security.enabled": true,
  "vesperaForge.security.strictMode": false,
  "vesperaForge.privacy.dataRetention": "standard",
  "vesperaForge.sanitization.level": "standard",
  "vesperaForge.security.notifications": "important"
}
```

Recommended consent settings:
- ✅ Usage Analytics (helps improve the extension)
- ✅ Error Reporting (helps fix bugs faster)
- ✅ Personalization (better user experience)
- ✅ Chat History (conversation continuity)

#### For Corporate/Compliance Environments

Enterprise-grade configuration:
```json
{
  "vesperaForge.security.enabled": true,
  "vesperaForge.security.strictMode": true,
  "vesperaForge.privacy.dataRetention": "minimal",
  "vesperaForge.sanitization.level": "strict",
  "vesperaForge.security.notifications": "all",
  "vesperaForge.audit.enabled": true
}
```

Recommended consent for compliance:
- ❌ Usage Analytics (unless approved by compliance)
- ❌ Error Reporting (unless approved by compliance)
- ❌ Personalization (unless approved by compliance)
- ❌ Chat History (unless approved by compliance)

## 🔍 Understanding Security Events

### Common Security Events

#### Rate Limiting
- **What happened**: You performed actions faster than the security limits allow
- **Why it matters**: Protects against abuse and ensures fair resource usage
- **What to do**: Wait for the cooldown period, then retry
- **Prevention**: Pace your actions, especially when using automation

#### Content Sanitization
- **What happened**: Potentially unsafe content was automatically cleaned
- **Why it matters**: Protects against XSS attacks and malicious code
- **What to do**: Usually nothing - the content has been made safe
- **Prevention**: Be cautious with content from untrusted sources

#### Threat Detection
- **What happened**: The system detected and blocked potentially malicious content
- **Why it matters**: Protects you from security threats and attacks
- **What to do**: Review the source of the content, avoid suspicious inputs
- **Prevention**: Only use trusted sources and be wary of suspicious content

### Security Status Indicators

#### Status Bar Indicators

When enabled, you'll see security status in the VS Code status bar:

- 🔒 **Green Shield**: All security systems normal
- 🟡 **Yellow Shield**: Minor security events (warnings)  
- 🔴 **Red Shield**: Critical security events (threats blocked)
- ⏸️ **Paused Shield**: Security temporarily disabled

Click the status indicator to:
- View recent security events
- Access privacy settings
- See security health summary

#### Command Palette Status

Use `Ctrl+Shift+P` → "Vespera: Security Status" to see:

```
Vespera Security Status
═══════════════════════

System Status: ✅ All systems operational
Last Check: 2 minutes ago

Recent Activity:
• 14:32 - Content sanitization applied
• 14:28 - Rate limit warning (resolved)
• 14:15 - Privacy consent updated

Privacy Status:
✅ 3 of 4 optional consents granted
🔒 Data encrypted and secure
📊 Compliance score: 98%

[View Details]  [Privacy Settings]  [Security Settings]
```

## 🛠️ Troubleshooting

### Common Issues and Solutions

#### "Rate Limit Exceeded" Messages

**Symptoms**: 
- "Please wait X seconds before retrying" notifications
- Delays in processing commands
- Temporary feature unavailability

**Solutions**:
1. **Wait it out**: The simplest solution - wait for the cooldown period
2. **Check your usage patterns**: Avoid rapid-fire commands or automation
3. **Adjust settings**: Contact support if limits seem too restrictive

**Prevention**:
- Avoid scripting rapid commands
- Space out intensive operations
- Use batch operations when available

#### "Content Blocked" Notifications

**Symptoms**:
- Content appears differently than expected
- HTML or rich content is stripped down
- Scripts or interactive elements removed

**Solutions**:
1. **Review content source**: Ensure content comes from trusted sources
2. **Check sanitization settings**: Consider lowering the sanitization level if appropriate
3. **Manual review**: Content may have been correctly identified as unsafe

**Prevention**:
- Use trusted content sources
- Be cautious with user-generated content
- Validate content before using in the extension

#### Privacy Dialog Issues

**Symptoms**:
- Consent dialog appears repeatedly
- Settings not being remembered
- Cannot access certain features

**Solutions**:
1. **Check browser storage**: Ensure VS Code has storage permissions
2. **Clear extension data**: Reset and reconfigure if corrupted
3. **Update extension**: Ensure you have the latest version

**Prevention**:
- Make deliberate consent choices
- Regularly review privacy settings
- Keep the extension updated

### Getting Help

#### Self-Service Options

1. **Documentation**:
   - This user guide
   - Extension README
   - VS Code extension documentation

2. **Settings Reset**:
   ```
   Command Palette → "Vespera: Reset Security Settings"
   ```

3. **Diagnostic Information**:
   ```
   Command Palette → "Vespera: Security Diagnostics"
   ```

#### Contacting Support

When contacting support, please include:

1. **Extension Version**: Check in Extensions panel
2. **VS Code Version**: Help → About
3. **Operating System**: Windows/Mac/Linux
4. **Error Details**: Exact error messages
5. **Steps to Reproduce**: What you were doing when the issue occurred

**Security Issue Reporting**:
- For security vulnerabilities, use our security contact
- Do not share sensitive information in public forums
- Include diagnostic information if safe to share

#### Privacy and Data Concerns

For privacy-related questions:
1. **Review this guide**: Most questions are answered here
2. **Check privacy settings**: Use the privacy dashboard
3. **Contact privacy officer**: For complex privacy questions
4. **Request data deletion**: Use the "Delete My Data" feature

## 📚 Best Practices

### Security Best Practices

1. **Keep the Extension Updated**
   - Enable automatic updates in VS Code
   - Review release notes for security improvements
   - Apply security updates promptly

2. **Use Strong Privacy Settings**
   - Only grant consent for features you actually use
   - Regularly review your privacy settings
   - Export your data periodically for backup

3. **Be Cautious with Content**
   - Verify sources of external content
   - Be wary of suspicious files or URLs
   - Let the security system do its job (don't disable protections)

4. **Monitor Security Events**
   - Pay attention to security notifications
   - Review the security status periodically
   - Report suspicious activity

### Privacy Best Practices

1. **Understand Your Consent Choices**
   - Read consent descriptions carefully
   - Only consent to data uses you're comfortable with
   - Remember you can change your mind anytime

2. **Regular Privacy Reviews**
   - Review your consent settings monthly
   - Check what data has been collected
   - Clean up unnecessary data

3. **Data Minimization**
   - Use the minimum data retention settings for your needs
   - Regularly export and delete old data
   - Disable features you don't use

### Performance Best Practices

1. **Optimize Security Settings**
   - Use "standard" security level for most users
   - Only use "strict" mode if you have specific security requirements
   - Balance security with functionality needs

2. **Manage Rate Limits**
   - Avoid rapid-fire commands
   - Use batch operations when available
   - Be patient with security checks

3. **Monitor Resource Usage**
   - Check extension memory usage if experiencing issues
   - Restart VS Code if security services seem slow
   - Report performance issues to support

## 🎯 Quick Reference

### Essential Commands

| Command | Shortcut | Purpose |
|---------|----------|---------|
| Privacy Settings | `Ctrl+Shift+P` → "Vespera: Privacy Settings" | Manage consent and privacy |
| Security Status | `Ctrl+Shift+P` → "Vespera: Security Status" | View security health |
| Export Data | Privacy Settings → "Export My Data" | Download your data |
| Delete Data | Privacy Settings → "Delete My Data" | Permanently remove data |
| Reset Settings | `Ctrl+Shift+P` → "Vespera: Reset Security Settings" | Reset to defaults |

### Key Settings Locations

| Setting | Location |
|---------|----------|
| Core Security | Settings → Extensions → Vespera Forge → Security |
| Privacy Controls | Command Palette → "Vespera: Privacy Settings" |
| Notifications | Settings → Extensions → Vespera Forge → Notifications |
| Data Export | Privacy Settings → "Export My Data" |

### Support Contacts

| Issue Type | Contact Method |
|------------|----------------|
| General Support | Extension documentation or GitHub issues |
| Security Issues | Security contact (see extension docs) |
| Privacy Questions | Privacy officer contact |
| Bug Reports | GitHub issues or extension marketplace |

---

**Remember**: Vespera Forge's security features are designed to protect you while maintaining a great development experience. When in doubt, choose more security over less, and don't hesitate to reach out for help!
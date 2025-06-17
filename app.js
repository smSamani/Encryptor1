/* ==========================  CRYPTO CORE - FIXED  ========================== */
async function encrypt(plaintext, password) {
    try {
        const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
        const iv   = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
        const key  = await deriveKey(password, salt);

        const encryptedData = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv, tagLength: TAG_LENGTH * 8 },
            key,
            stringToBuffer(plaintext)
        );

        const encryptedArray = new Uint8Array(encryptedData);
        
        // AES-GCM returns [ciphertext + tag], we need to split them
        const ciphertext = encryptedArray.slice(0, encryptedArray.length - TAG_LENGTH);
        const tag = encryptedArray.slice(encryptedArray.length - TAG_LENGTH);

        /* FORMAT: [ salt | iv | tag | ciphertext ]
           This format is compatible with the Python implementation
        */
        const result = new Uint8Array(SALT_LENGTH + IV_LENGTH + TAG_LENGTH + ciphertext.length);
        let offset = 0;
        result.set(salt, offset);           offset += SALT_LENGTH;
        result.set(iv, offset);             offset += IV_LENGTH;
        result.set(tag, offset);            offset += TAG_LENGTH;
        result.set(ciphertext, offset);

        return bufferToBase64(result);
    } catch (err) {
        throw new Error('Encryption failed: ' + err.message);
    }
}

async function decrypt(encoded, password) {
    try {
        const data = base64ToUint8Array(encoded);
        if (data.length < SALT_LENGTH + IV_LENGTH + TAG_LENGTH + 1) {
            throw new Error('Ciphertext too short');
        }

        // Parse the format: [ salt | iv | tag | ciphertext ]
        let offset = 0;
        const salt = data.slice(offset, offset + SALT_LENGTH);
        offset += SALT_LENGTH;
        const iv = data.slice(offset, offset + IV_LENGTH);
        offset += IV_LENGTH;
        const tag = data.slice(offset, offset + TAG_LENGTH);
        offset += TAG_LENGTH;
        const ciphertext = data.slice(offset);

        const key = await deriveKey(password, salt);

        // Reconstruct the format expected by Web Crypto API: [ciphertext + tag]
        const encryptedData = new Uint8Array(ciphertext.length + tag.length);
        encryptedData.set(ciphertext, 0);
        encryptedData.set(tag, ciphertext.length);

        const decryptedData = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv, tagLength: TAG_LENGTH * 8 },
            key,
            encryptedData
        );

        return bufferToString(decryptedData);
    } catch (err) {
        throw new Error('Decryption failed: ' + err.message);
    }
}
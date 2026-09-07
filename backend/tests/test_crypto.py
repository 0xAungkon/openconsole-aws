def test_encrypt_decrypt_round_trip():
    from app.utils import crypto

    secret = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
    token = crypto.encrypt(secret)
    assert token != secret  # stored form is not plaintext
    assert crypto.decrypt(token) == secret

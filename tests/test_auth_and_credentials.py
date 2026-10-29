def _register(client, email="a@example.com"):
    return client.post(
        "/api/auth/register",
        json={"name": "Ann", "email": email, "password": "supersecret"},
    )


def test_register_login_and_me(client):
    r = _register(client)
    assert r.status_code == 201, r.text
    token = r.json()["access_token"]
    assert r.json()["user"]["email"] == "a@example.com"

    # duplicate email is rejected
    assert _register(client).status_code == 409

    # login works and returns a token
    r = client.post(
        "/api/auth/login",
        json={"email": "a@example.com", "password": "supersecret"},
    )
    assert r.status_code == 200

    # /me requires the bearer token
    assert client.get("/api/auth/me").status_code == 401
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["email"] == "a@example.com"


def test_credentials_crud_hides_secrets(client):
    token = _register(client, email="c@example.com").json()["access_token"]
    auth = {"Authorization": f"Bearer {token}"}

    r = client.post(
        "/api/credentials",
        headers=auth,
        json={
            "label": "dev",
            "access_key_id": "AKIAIOSFODNN7EXAMPLE",
            "secret_access_key": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
            "default_region": "us-east-1",
        },
    )
    assert r.status_code == 201, r.text
    body = r.json()
    # secret material must never be returned
    assert "secret_access_key" not in body
    assert body["access_key_id"] == "AKIAIOSFODNN7EXAMPLE"

    listed = client.get("/api/credentials", headers=auth).json()
    assert len(listed) == 1
    assert "secret_access_key" not in listed[0]

    # credentials are scoped to the owner
    assert client.get("/api/credentials").status_code == 401

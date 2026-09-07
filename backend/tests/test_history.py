from uuid import uuid4


def register(client, email):
    result = client.post('/api/auth/register', json={
        'name': 'History User', 'email': email, 'password': 'supersecret',
    })
    return {'Authorization': f'Bearer {result.json()["access_token"]}'}


def entry(text, kind='terminal'):
    if kind == 'inspector':
        return {'id': str(uuid4()), 'payload': {
            'id': str(uuid4()), 'ts': 123, 'source': 'gui', 'command': text,
            'status': 'ok', 'durationMs': 1,
        }}
    return {'id': str(uuid4()), 'payload': {'text': text, 'kind': 'out'}}


def test_history_requires_login(client):
    assert client.get('/api/history').status_code == 401
    assert client.post('/api/history/terminal', json={'entries': [entry('guest')]}).status_code == 401
    assert client.delete('/api/history/terminal').status_code == 401


def test_history_survives_login_and_is_account_scoped(client):
    owner = register(client, 'owner@example.com')
    other = register(client, 'other@example.com')
    for kind in ('inspector', 'terminal', 'commands'):
        assert client.post(f'/api/history/{kind}', headers=owner,
                           json={'entries': [entry(kind, kind)]}).status_code == 204
    assert all(not rows for rows in client.get('/api/history', headers=other).json().values())
    assert client.delete('/api/history/terminal', headers=other).status_code == 204
    login = client.post('/api/auth/login', json={
        'email': 'owner@example.com', 'password': 'supersecret',
    })
    new_browser = {'Authorization': f'Bearer {login.json()["access_token"]}'}
    saved = client.get('/api/history', headers=new_browser).json()
    assert all(len(rows) == 1 for rows in saved.values())
    assert client.delete('/api/history/terminal', headers=new_browser).status_code == 204
    saved = client.get('/api/history', headers=owner).json()
    assert saved['terminal'] == []
    assert len(saved['commands']) == len(saved['inspector']) == 1


def test_history_append_retry_order_and_retention(client):
    auth = register(client, 'retention@example.com')
    batch = {'entries': [entry(str(i)) for i in range(500)]}
    for _ in range(2):
        assert client.post('/api/history/terminal', headers=auth, json=batch).status_code == 204
    saved = client.get('/api/history', headers=auth).json()['terminal']
    assert len(saved) == 500
    assert saved[0]['text'] == '0'
    assert client.post('/api/history/terminal', headers=auth,
                       json={'entries': [entry('new browser')]}).status_code == 204
    saved = client.get('/api/history', headers=auth).json()['terminal']
    assert len(saved) == 500
    assert saved[0]['text'] == '1'
    assert saved[-1]['text'] == 'new browser'
    for kind in ('commands', 'inspector'):
        assert client.post(f'/api/history/{kind}', headers=auth, json={'entries': [entry(str(i), kind) for i in range(500)]}).status_code == 204
        saved = client.get('/api/history', headers=auth).json()[kind]
        assert len(saved) == 200
        assert saved[0]['command' if kind == 'inspector' else 'text'] == '300'


def test_history_rejects_invalid_payload_without_partial_save(client):
    auth = register(client, 'invalid@example.com')
    assert client.post('/api/history/terminal', headers=auth, json={
        'entries': [entry('valid'), {'id': str(uuid4()), 'payload': {'kind': 'unknown'}}],
    }).status_code == 422
    assert client.get('/api/history', headers=auth).json()['terminal'] == []
    assert client.post('/api/history/unknown', headers=auth,
                       json={'entries': [entry('test')]}).status_code == 422

"""
Document endpoint tests
-----------------------
POST   /documents            — .txt upload success → 200 + status ready
POST   /documents            — .exe upload → 400
POST   /documents            — file > 10 MB → 400
GET    /documents            — list returns array
DELETE /documents/{id}       — 204 on valid owner
DELETE /documents/{id}       — 404 when doc not found
"""
import io


def test_upload_txt_success(client, auth_headers):
    content = b"Hello, this is a test document."
    resp = client.post(
        "/documents",
        headers=auth_headers,
        files={"file": ("sample.txt", io.BytesIO(content), "text/plain")},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "ready"
    assert body["name"] == "sample.txt"


def test_upload_invalid_extension(client, auth_headers):
    content = b"not allowed"
    resp = client.post(
        "/documents",
        headers=auth_headers,
        files={"file": ("malware.exe", io.BytesIO(content), "application/octet-stream")},
    )
    assert resp.status_code == 400
    assert "allowed" in resp.json()["detail"].lower()


def test_upload_too_large(client, auth_headers):
    # 11 MB > 10 MB limit
    big_content = b"x" * (11 * 1024 * 1024)
    resp = client.post(
        "/documents",
        headers=auth_headers,
        files={"file": ("big.txt", io.BytesIO(big_content), "text/plain")},
    )
    assert resp.status_code == 400
    assert "size" in resp.json()["detail"].lower() or "maximum" in resp.json()["detail"].lower()


def test_list_documents(client, auth_headers):
    resp = client.get("/documents", headers=auth_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_list_documents_no_auth(client):
    resp = client.get("/documents")
    assert resp.status_code == 401


def test_delete_document(client, auth_headers):
    # Upload a doc first
    content = b"To be deleted."
    upload = client.post(
        "/documents",
        headers=auth_headers,
        files={"file": ("delete_me.txt", io.BytesIO(content), "text/plain")},
    )
    assert upload.status_code == 200
    doc_id = upload.json()["id"]

    # Delete it
    delete_resp = client.delete(f"/documents/{doc_id}", headers=auth_headers)
    assert delete_resp.status_code == 204

    # Confirm gone
    list_resp = client.get("/documents", headers=auth_headers)
    ids = [d["id"] for d in list_resp.json()]
    assert doc_id not in ids


def test_delete_document_not_found(client, auth_headers):
    resp = client.delete("/documents/non-existent-id", headers=auth_headers)
    assert resp.status_code == 404

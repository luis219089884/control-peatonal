import json
import urllib.request

URL = "http://localhost:8000/graphql/"
HEADERS = {"Content-Type": "application/json"}


def gql(query, token=None):
    headers = dict(HEADERS)
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps({"query": query}).encode()
    req = urllib.request.Request(URL, data=data, headers=headers, method="POST")
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


# --- Prueba 1: Login admin ---
print("=" * 60)
print("PRUEBA 1 — Login admin")
print("=" * 60)
login_query = """
mutation {
  login(ci: "00000001", password: "admin123", tipoUsuario: "administrativo") {
    token
    rol
    nombres
    message
  }
}
"""
result = gql(login_query)
print(json.dumps(result, indent=2, ensure_ascii=False))
token = result.get("data", {}).get("login", {}).get("token", "")

# --- Prueba 2: Listar facultades (público) ---
print("\n" + "=" * 60)
print("PRUEBA 2 — Listar facultades (público)")
print("=" * 60)
facultades_query = """
query {
  listarFacultades {
    idFacultad
    nombre
    sede { nombre ciudad }
  }
}
"""
result2 = gql(facultades_query)
print(json.dumps(result2, indent=2, ensure_ascii=False))

# --- Prueba 3: Mi perfil (con token) ---
print("\n" + "=" * 60)
print("PRUEBA 3 — Mi perfil (autenticado)")
print("=" * 60)
if token:
    perfil_query = """
    query {
      miPerfil {
        idUsuario
        nombres
        apellidos
        tipoUsuario
        rol { nombre }
      }
    }
    """
    result3 = gql(perfil_query, token=token)
    print(json.dumps(result3, indent=2, ensure_ascii=False))
else:
    print("No se obtuvo token en el login, saltando prueba 3.")

import strawberry

from accesos.mutations import AccesoMutation
from accesos.queries import AccesoQuery
from usuarios.mutations import UsuarioMutation
from usuarios.queries import UsuarioQuery


@strawberry.type
class Query(UsuarioQuery, AccesoQuery):
    pass


@strawberry.type
class Mutation(UsuarioMutation, AccesoMutation):
    pass


schema = strawberry.Schema(query=Query, mutation=Mutation)

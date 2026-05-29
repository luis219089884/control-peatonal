import strawberry


@strawberry.type
class Query:
    @strawberry.field
    def health(self) -> str:
        return "CONTROL backend OK"


schema = strawberry.Schema(query=Query)

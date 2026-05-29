from django.contrib import admin
from django.conf import settings
from django.conf.urls.static import static
from django.urls import path
from strawberry.django.views import GraphQLView

from schema import schema

urlpatterns = [
    path("admin/", admin.site.urls),
    path("graphql/", GraphQLView.as_view(schema=schema, graphiql=True)),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

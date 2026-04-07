## Legacy

Esta carpeta concentra el CRM/auth/admin heredado que sigue funcionando en producción,
pero que no encaja en la estructura modular objetivo definida en `arquitectura.md`.

Regla operativa:
- No se elimina lógica viva desde acá hasta migrarla a `modules/` o `app/app/*`.
- Los archivos en sus paths originales quedan como wrappers para no romper rutas, tests e imports.


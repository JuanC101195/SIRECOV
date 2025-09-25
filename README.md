# SIRECOV (friend-plus) · Sprint 1

Mejora del proyecto del amigo:
- **UI con Tailwind** (formularios, toasts, layout limpio).
- Backend Express sirve el **frontend estático** (todo en un mismo puerto).
- **CSV con cabecera** `country,date,type,cases` y lectura que **omite la cabecera**.
- Validaciones estrictas (fecha ISO; type ∈ confirmed|death|recovered; cases entero ≥ 0).
- Evita duplicados por clave `country+date+type` (409).

## Ejecutar
```bash
npm install
npm start
# abrir http://localhost:3000
```

## Endpoints
- `POST /records`  → guarda registro CSV.
- `GET /records?country=&date=&type=` → consulta por clave única.
- `GET /health` → ping.

## Estructura
```
sirecov_friend_plus/
├─ .gitignore
├─ package.json
├─ backend/
│  ├─ server.js
│  ├─ storage.js
│  └─ validator.js
├─ frontend/
│  ├─ index.html
│  └─ app.js
└─ data/
   └─ covid_records.txt
```

## Subir a GitHub
```bash
git init
git add .
git commit -m "feat: Sprint 1 (friend-plus) UI Tailwind + CSV header + static hosting"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/sirecov_friend_plus.git
git push -u origin main
```

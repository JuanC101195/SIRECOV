# 📌 SIRECOV — Sprint 1 (friend-plus)

Sistema de Registro y Consulta de Casos COVID (SIRECOV) — primera entrega del curso de **Análisis de Datos**.  
Proyecto construido con **Node.js + Express** y **frontend con TailwindCSS**.

---

## ✨ Características

- Captura de registros con **validaciones estrictas**:
  - Fecha en formato `YYYY-MM-DD`
  - Tipo ∈ `confirmed | death | recovered`
  - Casos entero ≥ 0
- Persistencia en archivo plano `data/covid_records.txt` (CSV con cabecera).
- Consulta por clave única **country + date + type**.
- Manejo de errores:
  - `400` → parámetros inválidos
  - `404` → registro no encontrado
  - `409` → duplicado
- Frontend moderno con **TailwindCSS**.
- Backend y frontend servidos en un mismo puerto (`http://localhost:3000`).

---

## 📂 Estructura del proyecto

```
sirecov_friend_plus/
├─ backend/
│  ├─ server.js      # servidor Express
│  ├─ storage.js     # persistencia en CSV
│  └─ validator.js   # validaciones
├─ frontend/
│  ├─ index.html     # UI con Tailwind
│  └─ app.js         # lógica de frontend
├─ data/
│  └─ covid_records.txt   # archivo de registros
├─ package.json
├─ README.md
└─ .gitignore
```

---

## ⚡ Requisitos

- Node.js 18 o superior  
- Navegador moderno (Chrome, Edge, Firefox…)

---

## ▶ Ejecución

```bash
# Instalar dependencias
npm install

# Levantar el servidor
npm start

# Abrir en el navegador
http://localhost:3000
```

---

## 🧪 Endpoints de la API

### Health check
```bash
curl http://localhost:3000/health
```

### Crear registro
```bash
curl -X POST http://localhost:3000/records ^
 -H "Content-Type: application/json" ^
 -d "{\"country\":\"Colombia\",\"date\":\"2020-03-20\",\"type\":\"confirmed\",\"cases\":34}"
```

### Consultar registro
```bash
curl "http://localhost:3000/records?country=Colombia&date=2020-03-20&type=confirmed"
```

---

## 🖼️ Capturas

### Formulario de captura
![captura](./docs/captura.png)

### Consulta de registros
![consulta](./docs/consulta.png)

---

## 🚀 Despliegue en GitHub

```bash
git add .
git commit -m "docs: mejorar README con ejemplos y capturas"
git push
```


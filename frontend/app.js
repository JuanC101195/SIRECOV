// frontend/app.js
const $ = (sel) => document.querySelector(sel);

function toast(msg, ok = true) {
  const t = $("#toast");
  const box = $("#toast-box");
  box.textContent = msg;
  box.className = "px-4 py-3 rounded-xl shadow-lg text-sm " + (ok ? "bg-green-600 text-white" : "bg-rose-600 text-white");
  t.classList.remove("hidden");
  setTimeout(() => t.classList.add("hidden"), 2000);
}

// --- Agregar ---
$("#form-add")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  $("#add-msg").textContent = "";
  const payload = {
    country: $("#add-country").value,
    date: $("#add-date").value,
    type: $("#add-type").value,
    cases: Number($("#add-cases").value),
  };
  try {
    const res = await fetch(`/records`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      $("#add-msg").className = "text-rose-700";
      $("#add-msg").textContent = data.error || "Error al guardar";
      toast("Error al guardar", false);
    } else {
      $("#add-msg").className = "text-green-700";
      $("#add-msg").textContent = "Registro guardado ✅";
      toast("Registro guardado ✅", true);
      $("#form-add").reset();
    }
  } catch (err) {
    $("#add-msg").className = "text-rose-700";
    $("#add-msg").textContent = "Error de conexión con el servidor";
    toast("Error de conexión", false);
  }
});

// --- Consultar ---
$("#form-get")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  $("#get-msg").textContent = "";
  $("#get-result").classList.add("hidden");

  const q = new URLSearchParams({
    country: $("#get-country").value,
    date: $("#get-date").value,
    type: $("#get-type").value,
  });

  try {
    const res = await fetch(`/records?${q.toString()}`);
    const data = await res.json();
    if (!res.ok) {
      $("#get-msg").className = "text-rose-700";
      $("#get-msg").textContent = data.error || "No encontrado";
      toast("No encontrado", false);
      return;
    }
    const r = data.record;
    $("#r-country").textContent = r.country;
    $("#r-date").textContent = r.date;
    $("#r-type").textContent = r.type;
    $("#r-cases").textContent = r.cases;
    $("#get-result").classList.remove("hidden");
    $("#get-msg").className = "text-green-700";
    $("#get-msg").textContent = "Resultado encontrado ✅";
    toast("Resultado encontrado ✅", true);
  } catch (err) {
    $("#get-msg").className = "text-rose-700";
    $("#get-msg").textContent = "Error de conexión con el servidor";
    toast("Error de conexión", false);
  }
});

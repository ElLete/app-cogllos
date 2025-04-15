// ========== Variables globales ==========
let db;
let precioCompraGlobal = null;
let nextCompraID = 1;
let nextVentaID = 1;

// ========== Recuperar precioCompraGlobal desde localStorage ==========
const precioGuardado = localStorage.getItem("precioCompraGlobal");
if (precioGuardado) {
    precioCompraGlobal = parseFloat(precioGuardado);
}

// ========== Abrir IndexedDB "CogollosDB" versión 2 ==========
const request = indexedDB.open("CogollosDB", 2);

request.onupgradeneeded = function(event) {
    db = event.target.result;
    if (!db.objectStoreNames.contains("compras")) {
        db.createObjectStore("compras", { autoIncrement: true });
    }
    if (!db.objectStoreNames.contains("ventas")) {
        db.createObjectStore("ventas", { autoIncrement: true });
    }
};

request.onsuccess = function(event) {
    db = event.target.result;
    mostrarCompras();
    mostrarVentas();
};

request.onerror = function(event) {
    console.error("Error abriendo IndexedDB:", event.target.errorCode);
};

// ========== Mostrar Mensaje (Popup) ==========
function showMessage(mensaje) {
    const msgEl = document.getElementById("popupMessage");
    msgEl.innerText = mensaje;
    msgEl.classList.add("show");
    setTimeout(() => {
        msgEl.classList.remove("show");
    }, 3000);
}

// ========== Navegación entre secciones ==========
function mostrarSeccion(seccion) {
    document.getElementById("menu").style.display = "none";
    document.getElementById("seccion-compra").style.display = "none";
    document.getElementById("seccion-venta").style.display = "none";
    document.getElementById("seccion-historial").style.display = "none";
    
    if (seccion === "menu") {
        document.getElementById("menu").style.display = "block";
    } else if (seccion === "compra") {
        document.getElementById("seccion-compra").style.display = "block";
    } else if (seccion === "venta") {
        document.getElementById("seccion-venta").style.display = "block";
    } else if (seccion === "historial") {
        document.getElementById("seccion-historial").style.display = "block";
        mostrarCompras();
        mostrarVentas();
        mostrarResumen();
    }
}

// ========== Registrar Compra ==========
function registrarCompra() {
    const cantStr = document.getElementById("cogollosCompra").value;
    const totalStr = document.getElementById("totalCompra").value;
    if (!cantStr || !totalStr || parseInt(cantStr) <= 0 || parseInt(totalStr) <= 0) {
        showMessage("Ingresa valores válidos.");
        return;
    }
    const cantidad = parseInt(cantStr);
    const total = parseInt(totalStr);
    const precio_unitario = total / cantidad;
    precioCompraGlobal = precio_unitario;
    localStorage.setItem("precioCompraGlobal", precio_unitario); // Persistimos en localStorage

    const compra = {
        customID: nextCompraID,
        cantidad: cantidad,
        total: total,
        precio_unitario: precio_unitario,
        fecha: new Date().toLocaleString()
    };
    nextCompraID++;
    
    const trans = db.transaction(["compras"], "readwrite");
    const store = trans.objectStore("compras");
    store.add(compra);
    
    trans.oncomplete = function() {
        document.getElementById("cogollosCompra").value = "";
        document.getElementById("totalCompra").value = "";
        document.getElementById("resultadoCompra").innerText =
            "Precio por cogollo: $" + Math.round(precio_unitario).toLocaleString("es-CL");
        showMessage("Compra registrada con éxito.");
        mostrarCompras();
    };
}

// ========== Registrar Venta ==========
function registrarVenta() {
    const cantStr = document.getElementById("cogollosVenta").value;
    const totalStr = document.getElementById("totalVenta").value;
    if (!cantStr || !totalStr || parseInt(cantStr) <= 0 || parseInt(totalStr) <= 0) {
        showMessage("Ingresa valores válidos.");
        return;
    }
    const cantidad = parseInt(cantStr);
    const total = parseInt(totalStr);
    
    getInventory(function(inventory) {
        if (cantidad > inventory) {
            showMessage("Inventario insuficiente. Disponibles: " + inventory + " cogollos.");
            return;
        }
        if (precioCompraGlobal === null) {
            showMessage("Primero registra una compra para saber precio unitario.");
            return;
        }
        const precio_venta_unitario_raw = total / cantidad;
        const precio_venta_unitario = Math.round(precio_venta_unitario_raw);
        const ganancia_unitaria = precio_venta_unitario_raw - precioCompraGlobal;
        const ganancia_total = Math.round(ganancia_unitaria * cantidad);
        
        const venta = {
            customID: nextVentaID,
            cantidad: cantidad,
            total: total,
            precio_unitario_venta: precio_venta_unitario,
            ganancia_total: ganancia_total,
            fecha: new Date().toLocaleString()
        };
        nextVentaID++;
        
        const trans = db.transaction(["ventas"], "readwrite");
        const store = trans.objectStore("ventas");
        store.add(venta);
        
        trans.oncomplete = function() {
            document.getElementById("cogollosVenta").value = "";
            document.getElementById("totalVenta").value = "";
            document.getElementById("resultadoVenta").innerText =
                "Precio por cogollo: $" + precio_venta_unitario.toLocaleString("es-CL") +
                "\nGanancia total: $" + ganancia_total.toLocaleString("es-CL");
            showMessage("Venta registrada con éxito.");
            mostrarVentas();
        };
    });
}

// ========== Obtener Inventario ==========
function getInventory(callback) {
    let totalComprados = 0;
    let totalVendidos = 0;
    
    const transC = db.transaction(["compras"], "readonly");
    const storeC = transC.objectStore("compras");
    const reqC = storeC.openCursor();
    
    reqC.onsuccess = function(e) {
        const cursorC = e.target.result;
        if (cursorC) {
            totalComprados += cursorC.value.cantidad;
            cursorC.continue();
        } else {
            const transV = db.transaction(["ventas"], "readonly");
            const storeV = transV.objectStore("ventas");
            const reqV = storeV.openCursor();
            reqV.onsuccess = function(ev) {
                const cursorV = ev.target.result;
                if (cursorV) {
                    totalVendidos += cursorV.value.cantidad;
                    cursorV.continue();
                } else {
                    callback(totalComprados - totalVendidos);
                }
            };
        }
    };
}

// ========== Mostrar Compras ==========
function mostrarCompras() {
    const contCompras = document.getElementById("historialCompras");
    if (!contCompras) return;
    contCompras.innerHTML = "";
    
    const trans = db.transaction(["compras"], "readonly");
    const store = trans.objectStore("compras");
    const req = store.openCursor();
    
    let hayCompras = false;
    req.onsuccess = function(e) {
        const cursor = e.target.result;
        if (cursor) {
            hayCompras = true;
            const c = cursor.value;
            const formattedTotal = c.total.toLocaleString("es-CL");
            const formattedUnit = Math.round(c.precio_unitario).toLocaleString("es-CL");
            
            let texto = `ID: ${c.customID}, Fecha: ${c.fecha}, Cant: ${c.cantidad}\n`;
            texto += `Total: $${formattedTotal}, Precio: $${formattedUnit}\n`;
            texto += "--------------------------------------------\n";
            
            const div = document.createElement("div");
            div.classList.add("registro-item");
            div.textContent = texto;
            contCompras.appendChild(div);
            
            cursor.continue();
        } else if (!contCompras.hasChildNodes()) {
            const sin = document.createElement("div");
            sin.classList.add("registro-item");
            sin.textContent = "No hay registros de compras.";
            contCompras.appendChild(sin);
        }
    };
}

// ========== Mostrar Ventas ==========
function mostrarVentas() {
    const contVentas = document.getElementById("historialVentas");
    if (!contVentas) return;
    contVentas.innerHTML = "";
    
    const trans = db.transaction(["ventas"], "readonly");
    const store = trans.objectStore("ventas");
    const req = store.openCursor();
    
    let hayVentas = false;
    req.onsuccess = function(e) {
        const cursor = e.target.result;
        if (cursor) {
            hayVentas = true;
            const v = cursor.value;
            const formattedTotal = v.total.toLocaleString("es-CL");
            const formattedUnit = v.precio_unitario_venta.toLocaleString("es-CL");
            const formattedGan = v.ganancia_total.toLocaleString("es-CL");
            
            let texto = `ID: ${v.customID}, Fecha: ${v.fecha}, Cant: ${v.cantidad}\n`;
            texto += `Total: $${formattedTotal}, Precio: $${formattedUnit}, Gan: $${formattedGan}\n`;
            texto += "--------------------------------------------\n";
            
            const div = document.createElement("div");
            div.classList.add("registro-item");
            div.textContent = texto;
            contVentas.appendChild(div);
            
            cursor.continue();
        } else if (!contVentas.hasChildNodes()) {
            const sin = document.createElement("div");
            sin.classList.add("registro-item");
            sin.textContent = "No hay registros de ventas.";
            contVentas.appendChild(sin);
        }
    };
}

// ========== Mostrar Resumen ==========
function mostrarResumen() {
    const cont = document.getElementById("resumen");
    if (!cont) return;
    cont.innerHTML = "Cargando resumen...";
    
    let totalCompras = 0;
    let totalVentas = 0;
    
    const transC = db.transaction(["compras"], "readonly");
    const storeC = transC.objectStore("compras");
    const reqC = storeC.openCursor();
    
    reqC.onsuccess = function(e) {
        const cursorC = e.target.result;
        if (cursorC) {
            totalCompras += cursorC.value.total;
            cursorC.continue();
        } else {
            const transV = db.transaction(["ventas"], "readonly");
            const storeV = transV.objectStore("ventas");
            const reqV = storeV.openCursor();
            reqV.onsuccess = function(ev) {
                const cursorV = ev.target.result;
                if (cursorV) {
                    totalVentas += cursorV.value.total;
                    cursorV.continue();
                } else {
                    let saldo = totalVentas - totalCompras;
                    getInventory(function(inv) {
                        let texto = "Resumen:\n";
                        texto += `Total gastado: $${totalCompras.toLocaleString("es-CL")} CLP\n`;
                        texto += `Total en ventas: $${totalVentas.toLocaleString("es-CL")} CLP\n`;
                        texto += `Saldo: $${saldo.toLocaleString("es-CL")} CLP\n`;
                        texto += `Inventario actual: ${inv} cogollos`;
                        cont.innerHTML = texto.replace(/\n/g, "<br>");
                    });
                }
            };
        }
    };
}

// ========== Borrar Historial y Resetear IDs ==========
function borrarHistorial() {
    if (confirm("¿Estás seguro de borrar todo el historial?")) {
        const trans = db.transaction(["compras", "ventas"], "readwrite");
        trans.objectStore("compras").clear();
        trans.objectStore("ventas").clear();
        trans.oncomplete = function() {
            nextCompraID = 1;
            nextVentaID = 1;
            precioCompraGlobal = null;
            localStorage.removeItem("precioCompraGlobal");
            mostrarCompras();
            mostrarVentas();
            mostrarResumen();
            showMessage("Historial borrado.");
        };
    }
}

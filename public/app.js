import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, updateDoc, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Votre configuration Firebase (Plan Spark - Sans coût supplémentaire)
const firebaseConfig = {
  apiKey: "AIzaSyAuQGpeKrura990v7ifMUitfNieVLnNT-w",
  authDomain: "lotostradamus-e09e6.firebaseapp.com",
  projectId: "lotostradamus-e09e6",
  storageBucket: "lotostradamus-e09e6.firebasestorage.app",
  messagingSenderId: "1096271499861",
  appId: "1:1096271499861:web:02f6ea7d60c83e4db93adc",
  measurementId: "G-PH0N6DHQKP"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// DOM Elements
const formPronostic = document.getElementById("form-pronostic");
const formTirage = document.getElementById("form-tirage");

// --- Authentification (propriétaire) ---
const zoneLogin = document.getElementById("zone-login");
const zoneUser = document.getElementById("zone-user");
const loginErreur = document.getElementById("login-erreur");

document.getElementById("btn-login").addEventListener("click", async () => {
  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;
  loginErreur.innerText = "";
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    loginErreur.innerText = "Échec de la connexion : " + error.message;
  }
});

document.getElementById("btn-logout").addEventListener("click", () => signOut(auth));

// Réagit à l'état de connexion : affiche/masque les formulaires
onAuthStateChanged(auth, (user) => {
  const connecte = !!user;
  zoneLogin.style.display = connecte ? "none" : "block";
  zoneUser.style.display = connecte ? "block" : "none";
  formPronostic.closest(".section").style.display = connecte ? "block" : "none";
  formTirage.closest(".section").style.display = connecte ? "block" : "none";
  if (connecte) {
    document.getElementById("user-email").innerText = user.email;
  }
  // Re-render les tables pour afficher/masquer les boutons Modifier/Supprimer
  chargerPronostics();
  chargerTirages();
});

// 1. Ajouter un pronostic
formPronostic.addEventListener("submit", async (e) => {
  e.preventDefault();
  const numeros = [
    parseInt(document.getElementById("p1").value),
    parseInt(document.getElementById("p2").value),
    parseInt(document.getElementById("p3").value),
    parseInt(document.getElementById("p4").value),
    parseInt(document.getElementById("p5").value),
  ];
  const chance = parseInt(document.getElementById("pc").value);
  const date = new Date(document.getElementById("p-date").value).toISOString();

  try {
    await addDoc(collection(db, "predictions"), {
      date,
      numeros,
      chance,
      evalue: false,
      nbrMatch: 0,
      chanceMatch: false
    });
    // Évaluer tout de suite si un tirage de la même date existe déjà
    await evaluerPronostics();

    alert("Pronostic enregistré avec succès !");
    formPronostic.reset();
    chargerStats();
    chargerPronostics();
  } catch (error) {
    console.error("Erreur lors de l'enregistrement : ", error);
  }
});

// 2. Enregistrer un tirage et évaluer les pronostics en attente
formTirage.addEventListener("submit", async (e) => {
  e.preventDefault();
  const tirageNumeros = [
    parseInt(document.getElementById("t1").value),
    parseInt(document.getElementById("t2").value),
    parseInt(document.getElementById("t3").value),
    parseInt(document.getElementById("t4").value),
    parseInt(document.getElementById("t5").value),
  ];
  const tirageChance = parseInt(document.getElementById("tc").value);
  const tirageDate = new Date(document.getElementById("t-date").value).toISOString();

  try {
    // Étape A : Enregistrer le tirage
    await addDoc(collection(db, "tirages"), {
      date: tirageDate,
      numeros: tirageNumeros,
      chance: tirageChance
    });

    // Étape B : Évaluer les pronostics contre les tirages de même date
    await evaluerPronostics();

    alert("Tirage enregistré et pronostics mis à jour !");
    formTirage.reset();
    chargerStats();
    chargerPronostics();
    chargerTirages();
  } catch (error) {
    console.error("Erreur lors de l'évaluation : ", error);
  }
});

// Évalue les pronostics non encore évalués contre le tirage de MÊME date
async function evaluerPronostics() {
  const [tiragesSnap, predictionsSnap] = await Promise.all([
    getDocs(collection(db, "tirages")),
    getDocs(collection(db, "predictions")),
  ]);

  // Indexer les tirages par jour (AAAA-MM-JJ)
  const tiragesParJour = {};
  tiragesSnap.forEach((d) => {
    const t = d.data();
    tiragesParJour[t.date.slice(0, 10)] = t;
  });

  // Pour chaque pronostic en attente, chercher le tirage du même jour
  const misesAJour = [];
  predictionsSnap.forEach((docSnap) => {
    const data = docSnap.data();
    if (data.evalue) return;

    const tirage = tiragesParJour[data.date.slice(0, 10)];
    if (!tirage) return; // pas encore de tirage pour cette date

    const nbrMatch = data.numeros.filter((num) => tirage.numeros.includes(num)).length;
    const chanceMatch = (data.chance === tirage.chance);

    misesAJour.push(updateDoc(doc(db, "predictions", docSnap.id), {
      evalue: true,
      nbrMatch,
      chanceMatch,
    }));
  });

  await Promise.all(misesAJour);
}

// 3. Calculer les statistiques et afficher l'historique
async function chargerStats() {
  const querySnapshot = await getDocs(collection(db, "predictions"));
  let totalEvalues = 0;
  let reussites = 0; // Un pronostic est réussi s'il y a au moins 1 numéro ou le numéro chance correct
  let html = "<ul>";

  querySnapshot.forEach((doc) => {
    const data = doc.data();
    if (data.evalue) {
      totalEvalues++;
      const estGagnant = data.nbrMatch > 0 || data.chanceMatch;
      if (estGagnant) reussites++;

      html += `<li>Pronostic du ${new Date(data.date).toLocaleDateString()} : 
        [${data.numeros.join(", ")}] (Chance: ${data.chance}) — 
        <strong>${data.nbrMatch} numéros</strong> trouvés et 
        <strong>${data.chanceMatch ? "Chance trouvée" : "Chance manquée"}</strong>.</li>`;
    }
  });
  html += "</ul>";

  document.getElementById("historique").innerHTML = html;

  if (totalEvalues > 0) {
    const taux = Math.round((reussites / totalEvalues) * 100);
    document.getElementById("taux-reussite").innerText = `${taux}% (${reussites}/${totalEvalues})`;
  } else {
    document.getElementById("taux-reussite").innerText = "0% (Aucun pronostic évalué)";
  }
}

// Afficher tous les pronostics enregistrés (évalués et en attente)
async function chargerPronostics() {
  const querySnapshot = await getDocs(collection(db, "predictions"));

  // Trier du plus récent au plus ancien (en conservant l'id du document)
  const pronostics = querySnapshot.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const conteneur = document.getElementById("liste-pronostics");
  if (pronostics.length === 0) {
    conteneur.innerHTML = "<p>Aucun pronostic enregistré pour l'instant.</p>";
    return;
  }

  const connecte = !!auth.currentUser;
  let html = `<table>
    <thead>
      <tr><th>Date</th><th>Numéros</th><th>Chance</th><th>Statut</th>${connecte ? "<th>Actions</th>" : ""}</tr>
    </thead>
    <tbody>`;
  pronostics.forEach((data) => {
    let statut;
    if (!data.evalue) {
      statut = "⏳ En attente d'un tirage";
    } else {
      const estGagnant = data.nbrMatch > 0 || data.chanceMatch;
      statut = `${estGagnant ? "✅" : "❌"} ${data.nbrMatch} numéro(s) + ${data.chanceMatch ? "chance trouvée" : "chance manquée"}`;
    }
    html += `<tr data-id="${data.id}">
      <td>${new Date(data.date).toLocaleDateString()}</td>
      <td>${data.numeros.join(", ")}</td>
      <td>${data.chance}</td>
      <td>${statut}</td>
      ${connecte ? `<td><button class="btn-modifier">✏️</button> <button class="btn-supprimer">🗑️</button></td>` : ""}
    </tr>`;
  });
  html += "</tbody></table>";
  conteneur.innerHTML = html;

  if (!connecte) return;
  conteneur.querySelectorAll("tr[data-id]").forEach((tr) => {
    const data = pronostics.find((p) => p.id === tr.dataset.id);
    tr.querySelector(".btn-supprimer").addEventListener("click", () => supprimerPronostic(data.id));
    tr.querySelector(".btn-modifier").addEventListener("click", () => editerPronostic(tr, data));
  });
}

// Supprimer un pronostic
async function supprimerPronostic(id) {
  if (!confirm("Supprimer ce pronostic ?")) return;
  await deleteDoc(doc(db, "predictions", id));
  chargerStats();
  chargerPronostics();
}

// Édition en ligne d'un pronostic : remplace la ligne par des champs de saisie
function editerPronostic(tr, data) {
  const jour = data.date.slice(0, 10);
  const inputsNumeros = data.numeros
    .map((n, i) => `<input type="number" min="1" max="49" value="${n}" data-num="${i}" style="width:40px;">`)
    .join(" ");
  tr.innerHTML = `
    <td><input type="date" value="${jour}" class="edit-date" style="width:auto;"></td>
    <td>${inputsNumeros}</td>
    <td><input type="number" min="1" max="10" value="${data.chance}" class="edit-chance" style="width:50px;"></td>
    <td>—</td>
    <td><button class="btn-enregistrer">💾</button> <button class="btn-annuler">✖</button></td>`;

  tr.querySelector(".btn-annuler").addEventListener("click", chargerPronostics);
  tr.querySelector(".btn-enregistrer").addEventListener("click", async () => {
    const numeros = [...tr.querySelectorAll("input[data-num]")].map((inp) => parseInt(inp.value));
    const chance = parseInt(tr.querySelector(".edit-chance").value);
    const date = new Date(tr.querySelector(".edit-date").value).toISOString();
    // Ré-initialiser l'évaluation : les numéros/la date ont pu changer
    await updateDoc(doc(db, "predictions", data.id), {
      date, numeros, chance, evalue: false, nbrMatch: 0, chanceMatch: false,
    });
    await evaluerPronostics();
    chargerStats();
    chargerPronostics();
  });
}

// Afficher tous les tirages enregistrés
async function chargerTirages() {
  const querySnapshot = await getDocs(collection(db, "tirages"));

  // Trier du plus récent au plus ancien (en conservant l'id du document)
  const tirages = querySnapshot.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const conteneur = document.getElementById("liste-tirages");
  if (tirages.length === 0) {
    conteneur.innerHTML = "<p>Aucun tirage enregistré pour l'instant.</p>";
    return;
  }

  const connecte = !!auth.currentUser;
  let html = `<table>
    <thead>
      <tr><th>Date</th><th>Numéros</th><th>Chance</th>${connecte ? "<th>Actions</th>" : ""}</tr>
    </thead>
    <tbody>`;
  tirages.forEach((data) => {
    html += `<tr data-id="${data.id}">
      <td>${new Date(data.date).toLocaleDateString()}</td>
      <td>${data.numeros.join(", ")}</td>
      <td>${data.chance}</td>
      ${connecte ? `<td><button class="btn-modifier">✏️</button> <button class="btn-supprimer">🗑️</button></td>` : ""}
    </tr>`;
  });
  html += "</tbody></table>";
  conteneur.innerHTML = html;

  if (!connecte) return;
  conteneur.querySelectorAll("tr[data-id]").forEach((tr) => {
    const data = tirages.find((t) => t.id === tr.dataset.id);
    tr.querySelector(".btn-supprimer").addEventListener("click", () => supprimerTirage(data));
    tr.querySelector(".btn-modifier").addEventListener("click", () => editerTirage(tr, data));
  });
}

// Remet à "en attente" les pronostics d'un jour donné, puis ré-évalue.
// Utile quand un tirage change ou est supprimé.
async function reinitialiserEvaluationDuJour(jour) {
  const querySnapshot = await getDocs(collection(db, "predictions"));
  const resets = [];
  querySnapshot.forEach((docSnap) => {
    const p = docSnap.data();
    if (p.evalue && p.date.slice(0, 10) === jour) {
      resets.push(updateDoc(doc(db, "predictions", docSnap.id), {
        evalue: false, nbrMatch: 0, chanceMatch: false,
      }));
    }
  });
  await Promise.all(resets);
  await evaluerPronostics();
}

// Supprimer un tirage (les pronostics de cette date repassent en attente)
async function supprimerTirage(data) {
  if (!confirm("Supprimer ce tirage ?")) return;
  await deleteDoc(doc(db, "tirages", data.id));
  await reinitialiserEvaluationDuJour(data.date.slice(0, 10));
  chargerStats();
  chargerPronostics();
  chargerTirages();
}

// Édition en ligne d'un tirage
function editerTirage(tr, data) {
  const jour = data.date.slice(0, 10);
  const inputsNumeros = data.numeros
    .map((n, i) => `<input type="number" min="1" max="49" value="${n}" data-num="${i}" style="width:40px;">`)
    .join(" ");
  tr.innerHTML = `
    <td><input type="date" value="${jour}" class="edit-date" style="width:auto;"></td>
    <td>${inputsNumeros}</td>
    <td><input type="number" min="1" max="10" value="${data.chance}" class="edit-chance" style="width:50px;"></td>
    <td><button class="btn-enregistrer">💾</button> <button class="btn-annuler">✖</button></td>`;

  tr.querySelector(".btn-annuler").addEventListener("click", chargerTirages);
  tr.querySelector(".btn-enregistrer").addEventListener("click", async () => {
    const numeros = [...tr.querySelectorAll("input[data-num]")].map((inp) => parseInt(inp.value));
    const chance = parseInt(tr.querySelector(".edit-chance").value);
    const date = new Date(tr.querySelector(".edit-date").value).toISOString();
    const ancienJour = data.date.slice(0, 10);
    await updateDoc(doc(db, "tirages", data.id), { date, numeros, chance });
    // Ré-évaluer l'ancienne date (au cas où elle change) et la nouvelle
    await reinitialiserEvaluationDuJour(ancienJour);
    await reinitialiserEvaluationDuJour(date.slice(0, 10));
    chargerStats();
    chargerPronostics();
    chargerTirages();
  });
}

// Pré-remplir les champs date avec la date du jour (format AAAA-MM-JJ)
const aujourdhui = new Date().toISOString().slice(0, 10);
document.getElementById("p-date").value = aujourdhui;
document.getElementById("t-date").value = aujourdhui;

// Chargement initial
chargerStats();
chargerPronostics();
chargerTirages();

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
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

    // Étape B : Évaluer tous les pronostics non encore évalués
    const querySnapshot = await getDocs(collection(db, "predictions"));
    querySnapshot.forEach(async (documentSnapshot) => {
      const data = documentSnapshot.data();
      if (!data.evalue) {
        // Compter les correspondances
        const nbrMatch = data.numeros.filter(num => tirageNumeros.includes(num)).length;
        const chanceMatch = (data.chance === tirageChance);

        // Mettre à jour la prédiction
        const predictionRef = doc(db, "predictions", documentSnapshot.id);
        await updateDoc(predictionRef, {
          evalue: true,
          nbrMatch: nbrMatch,
          chanceMatch: chanceMatch
        });
      }
    });

    alert("Tirage enregistré et pronostics mis à jour !");
    formTirage.reset();
    chargerStats();
    chargerPronostics();
    chargerTirages();
  } catch (error) {
    console.error("Erreur lors de l'évaluation : ", error);
  }
});

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

  // Trier du plus récent au plus ancien
  const pronostics = querySnapshot.docs
    .map((d) => d.data())
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  if (pronostics.length === 0) {
    document.getElementById("liste-pronostics").innerHTML = "<p>Aucun pronostic enregistré pour l'instant.</p>";
    return;
  }

  let html = `<table>
    <thead>
      <tr><th>Date</th><th>Numéros</th><th>Chance</th><th>Statut</th></tr>
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
    html += `<tr>
      <td>${new Date(data.date).toLocaleDateString()}</td>
      <td>${data.numeros.join(", ")}</td>
      <td>${data.chance}</td>
      <td>${statut}</td>
    </tr>`;
  });
  html += "</tbody></table>";

  document.getElementById("liste-pronostics").innerHTML = html;
}

// Afficher tous les tirages enregistrés
async function chargerTirages() {
  const querySnapshot = await getDocs(collection(db, "tirages"));

  // Trier du plus récent au plus ancien
  const tirages = querySnapshot.docs
    .map((d) => d.data())
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  if (tirages.length === 0) {
    document.getElementById("liste-tirages").innerHTML = "<p>Aucun tirage enregistré pour l'instant.</p>";
    return;
  }

  let html = `<table>
    <thead>
      <tr><th>Date</th><th>Numéros</th><th>Chance</th></tr>
    </thead>
    <tbody>`;
  tirages.forEach((data) => {
    html += `<tr>
      <td>${new Date(data.date).toLocaleDateString()}</td>
      <td>${data.numeros.join(", ")}</td>
      <td>${data.chance}</td>
    </tr>`;
  });
  html += "</tbody></table>";

  document.getElementById("liste-tirages").innerHTML = html;
}

// Pré-remplir les champs date avec la date du jour (format AAAA-MM-JJ)
const aujourdhui = new Date().toISOString().slice(0, 10);
document.getElementById("p-date").value = aujourdhui;
document.getElementById("t-date").value = aujourdhui;

// Chargement initial
chargerStats();
chargerPronostics();
chargerTirages();

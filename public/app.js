import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Votre configuration Firebase (Plan Spark - Sans coût supplémentaire)
const firebaseConfig = {
  projectId: "lotostradamus-e09e6",
  // Ajoutez votre apiKey, authDomain, etc., depuis les paramètres de votre projet dans la console Firebase
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// DOM Elements
const formPronostic = document.getElementById("form-pronostic");
const formTirage = document.getElementById("form-tirage");

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

  try {
    await addDoc(collection(db, "predictions"), {
      date: new Date().toISOString(),
      numeros,
      chance,
      evalue: false,
      nbrMatch: 0,
      chanceMatch: false
    });
    alert("Pronostic enregistré avec succès !");
    formPronostic.reset();
    chargerStats();
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

  try {
    // Étape A : Enregistrer le tirage
    await addDoc(collection(db, "tirages"), {
      date: new Date().toISOString(),
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

// Chargement initial
chargerStats();

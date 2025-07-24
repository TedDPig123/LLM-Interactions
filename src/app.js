const headers = [
  "User ID", "Age", "Gender", "Height (cm)", "Weight (kg)",
  "Workout Type", "Workout Duration (mins)", "Calories Burned", "Heart Rate (bpm)",
  "Steps Taken", "Distance (km)", "Workout Intensity", "Sleep Hours", "Water Intake (liters)",
  "Daily Calories Intake", "Resting Heart Rate (bpm)", "VO2 Max", "Body Fat (%)",
  "Mood Before Workout", "Mood After Workout"
];

const checkboxesDiv = document.getElementById("checkboxes");
checkboxesDiv.innerHTML = headers.map(header => `
  <label>
    <input type="checkbox" name="fields" value="${header}" checked />
    ${header}
  </label>
`).join("");

document.getElementById("gen-image").addEventListener("click", async () => {
  try {
    const selectedFields = Array.from(document.querySelectorAll('input[name="fields"]:checked'))
      .map(input => input.value);

    const userQuery = document.getElementById("user-query").value.trim();
    const userConstraints = document.getElementById("user-constraints").value.trim();
    const numGenerations = parseInt(document.getElementById("num-generations").value) || 1;
    const apiKeyOpenAI = document.getElementById("api-key-openai").value.trim();
    const apiKeyClaude = document.getElementById("api-key-claude").value.trim();

    if (!apiKeyOpenAI || !apiKeyClaude || selectedFields.length === 0 || numGenerations < 1) {
      alert("Please enter both API keys, select fields, and set prompt.");
      return;
    }

    const svgContainer = document.getElementById("svg-container");
    svgContainer.innerHTML = "";

    const fetchPromises = Array.from({ length: numGenerations }, () =>
      fetch(`http://localhost:3000/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: selectedFields,
          prompt: userQuery,
          constraints: userConstraints,
          apiKeyOpenAI,
          apiKeyClaude
        }),
      }).then(res => res.ok ? res.json() : Promise.reject("Server error"))
    );

    const results = await Promise.all(fetchPromises);

    results.forEach(({ row, svgClaude, svgOpenAI, rawClaude, rawOpenAI }, i) => {
      const rowData = Object.entries(row).map(([k, v]) => `${k}: ${v}`).join(" | ");

      const rowHTML = `
        <div class="svg-row">
          <div class="cell raw-data">${rowData}</div>
          <div class="cell svg">${svgOpenAI}</div>
          <div class="cell svg">${svgClaude}</div>
          <div class="cell raw-text"><textarea>${rawOpenAI}</textarea></div>
          <div class="cell raw-text"><textarea>${rawClaude}</textarea></div>
        </div>
      `;
      svgContainer.insertAdjacentHTML("beforeend", rowHTML);
    });
  } catch (err) {
    console.error("Error:", err);
    alert("SVG generation failed. See console.");
  }
});

// document.getElementById("gen-image").addEventListener("click", async () => {
//   try {
//     const selectedFields = Array.from(document.querySelectorAll('input[name="fields"]:checked'))
//       .map(input => input.value);

//     const userQuery = document.getElementById("user-query").value.trim();
//     const userConstraints = document.getElementById("user-constraints").value.trim();
//     const numGenerations = parseInt(document.getElementById("num-generations").value) || 1;
//     const apiKey = document.getElementById("api-key").value.trim();
//     const provider = document.getElementById("provider").value;

//     if (!apiKey || selectedFields.length === 0 || numGenerations < 1) {
//       alert("Please enter an API key, select fields, and provide a prompt.");
//       return;
//     }

//     const svgContainer = document.getElementById("svg-container");
//     const dataOutput = document.getElementById("data-output");
//     svgContainer.innerHTML = "";
//     dataOutput.innerHTML = "";

//     const fetchPromises = Array.from({ length: numGenerations }, () =>
//       fetch(`http://localhost:3000/generate`, {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify({
//           fields: selectedFields,
//           prompt: userQuery,
//           constraints: userConstraints,
//           modelProvider: provider,
//           apiKey: apiKey,
//         }),
//       }).then(res => {
//         if (!res.ok) throw new Error("Server error");
//         return res.json();
//       })
//     );

//     const results = await Promise.all(fetchPromises);

//     results.forEach(({ row, svg }, i) => {
//       const dataHTML = `
//         <div class="data-block">
//           <h3>Workout Data #${i + 1}</h3>
//           <ul>
//             ${Object.entries(row).map(([key, value]) => `<li><strong>${key}:</strong> ${value}</li>`).join("")}
//           </ul>
//         </div>
//       `;
//       dataOutput.innerHTML += dataHTML;

//       const svgWrapper = document.createElement("div");
//       svgWrapper.classList.add("svg-wrapper");
//       svgWrapper.innerHTML = svg;
//       svgContainer.appendChild(svgWrapper);
//     });
//   } catch (err) {
//     console.error("Error:", err);
//     alert("Failed to generate SVGs. See console for details.");
//   }
// });

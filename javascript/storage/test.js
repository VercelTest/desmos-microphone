function generateDesmosOutput(intervals) {
    const outputDiv = document.getElementById('output');
    let rawText = "";      // for clipboard
    let displayText = "";  // for HTML display

    intervals.forEach((interval, intervalIdx) => {
        interval.forEach(([freq, volume]) => {
            const startT = intervalIdx - 1;
            const endT = intervalIdx + 1;

            // Raw text: literal < and >
            rawText += `\\operatorname{tone}\\left(${Math.round(freq)}, ${volume.toFixed(2)}\\right)\\left\\{${startT}<t<${endT}\\right\\}\n`;

            // Display text: escape < and > for HTML
            displayText += `\\operatorname{tone}\\left(${Math.round(freq)}, ${volume.toFixed(2)}\\right)\\left\\{${startT}&lt;t&lt;${endT}\\right\\}\n`;
        });
    });

    // Save raw text for copy
    outputDiv.dataset.raw = rawText;

    // Display HTML-safe version
    const lines = displayText.split('\n');
    outputDiv.innerHTML = lines.map(line => `<span>${line || '&nbsp;'}</span>`).join('');
}

// better version

function generateDesmosOutput(intervals) {
    const outputDiv = document.getElementById('output');
    let rawText = "";
    let displayText = "";

    intervals.forEach((interval, intervalIdx) => {
        if (interval.length === 0) return;

        // Prepare arrays for frequencies (a) and volumes (b)
        const freqArray = `[${interval.map(([f]) => Math.round(f)).join(", ")}]`;
        const volArray = `[${interval.map(([f, v]) => v.toFixed(2)).join(", ")}]`;

        // Slightly overlapping time range
        const tStart = intervalIdx - 1;
        const tEnd = intervalIdx + 2;

        // Construct the Desmos line using your template
        rawText += `\\operatorname{tone}\\left(a,\\ b\\right) \\operatorname{for} a=${freqArray}, b=${volArray}\\left\\{${tStart}<t<${tEnd}\\right\\}\n`;

        displayText += `\\operatorname{tone}\\left(a,\\ b\\right) \\operatorname{for} a=${freqArray}, b=${volArray}\\left\\{${tStart}&lt;t&lt;${tEnd}\\right\\}\n`;
    });

    // Save raw text for copy
    outputDiv.dataset.raw = rawText;

    const lines = displayText.split('\n');
    outputDiv.innerHTML = lines.map(line => `<span>${line || '&nbsp;'}</span>`).join('');
}
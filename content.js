console.log("Rasathane Enhancer: Content script running.");

function normalizeString(str) {
  if (!str) return "";

  const turkishMap = {
    ı: "i",
    I: "i",
    i: "i",
    İ: "i",
    ş: "s",
    Ş: "s",
    ğ: "g",
    Ğ: "g",
    ü: "u",
    Ü: "u",
    ö: "o",
    Ö: "o",
    ç: "c",
    Ç: "c",
  };

  let replaced = str.replace(/[ıIiİşŞğĞüÜöÖçÇ]/g, function (match) {
    return turkishMap[match];
  });

  let normalized = replaced.toLowerCase();

  return normalized;
}

function parseData(preText) {
  const lines = preText.split("\n");
  const earthquakes = [];
  let dataStarted = false;

  let headerLinesContent = {
    title: "",
    subtitle: "",
    note: "",
  };
  let headerLineCount = 0;

  const cols = {
    date: [0, 10],
    time: [11, 19],
    lat: [21, 28],
    lon: [31, 38],
    depth: [40, 50],
    md: [54, 58],
    ml: [59, 63],
    mw: [64, 68],
    location: [71, 118],
    quality: [119, -1],
  };

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    if (
      !dataStarted &&
      !trimmedLine.startsWith("----------") &&
      headerLineCount < 3
    ) {
      const cleanedLine = trimmedLine.replace(/^\.+|\.+$/g, "").trim();
      if (headerLineCount === 0) headerLinesContent.title = cleanedLine;
      else if (headerLineCount === 1) headerLinesContent.subtitle = cleanedLine;
      else if (headerLineCount === 2) headerLinesContent.note = cleanedLine;
      headerLineCount++;
      continue;
    }

    if (trimmedLine.startsWith("----------")) {
      if (!dataStarted) {
        dataStarted = true;
      }
      continue;
    }

    if (!dataStarted) {
      continue;
    }

    if (!/^\d{4}\./.test(trimmedLine)) {
      continue;
    }

    try {
      const dateStr = line.substring(...cols.date).trim();
      const timeStr = line.substring(...cols.time).trim();
      const latStr = line.substring(...cols.lat).trim();
      const lonStr = line.substring(...cols.lon).trim();
      const depthStr = line.substring(...cols.depth).trim();
      const mdStr = line.substring(...cols.md).trim();
      const mlStr = line.substring(...cols.ml).trim();
      const mwStr = line.substring(...cols.mw).trim();
      const locationStr = line.substring(...cols.location).trimEnd();
      const qualityStr = line.substring(cols.quality[0]).trim();

      const dateTimeStr = `${dateStr.replace(/\./g, "-")}T${timeStr}`;
      const eventDate = new Date(dateTimeStr);

      if (isNaN(eventDate)) {
        console.warn(
          "Rasathane Enhancer: Skipping row due to invalid date:",
          line,
        );
        continue;
      }

      earthquakes.push({
        date: dateStr,
        time: timeStr,
        lat: latStr,
        lon: lonStr,
        depth: depthStr,
        md: mdStr,
        ml: mlStr,
        mw: mwStr,
        location: locationStr,
        quality: qualityStr,
        eventDate: eventDate,
        originalLine: line,
      });
    } catch (e) {
      console.warn("Rasathane Enhancer: Error parsing line:", line, e);
    }
  }
  return { headerInfo: headerLinesContent, earthquakes };
}

function timeAgo(date) {
  const now = new Date();
  const eventDate = date instanceof Date ? date : new Date(date);
  if (isNaN(eventDate)) {
    return "Invalid date";
  }

  const totalSeconds = Math.floor((now - eventDate) / 1000);

  if (totalSeconds < 1) {
    return "just now";
  }

  const days = Math.floor(totalSeconds / 86400);
  if (days >= 7) {
    const weeks = Math.floor(days / 7);
    if (weeks >= 4) {
      const months = Math.floor(days / 30.44);
      if (months >= 12) {
        const years = Math.floor(days / 365.25);
        return years + "y ago";
      }
      return months + "mo ago";
    }
    return weeks + "w ago";
  }
  if (days >= 1) {
    const remainingSecondsAfterDays = totalSeconds % 86400;
    const hoursToday = Math.floor(remainingSecondsAfterDays / 3600);
    if (hoursToday > 0) {
      return days + "d " + hoursToday + "h ago";
    } else {
      return days + "d ago";
    }
  }

  const hours = Math.floor(totalSeconds / 3600);
  const remainingSecondsAfterHours = totalSeconds % 3600;
  const minutes = Math.floor(remainingSecondsAfterHours / 60);
  const seconds = remainingSecondsAfterHours % 60;

  const parts = [];

  if (hours >= 1) {
    parts.push(hours + "h");
    if (minutes > 0) {
      parts.push(minutes + "m");
    }
    return parts.join(" ") + " ago";
  } else if (minutes >= 1) {
    parts.push(minutes + "m");
    if (seconds > 0) {
      parts.push(seconds + "s");
    }
    return parts.join(" ") + " ago";
  } else {
    parts.push(Math.max(0, seconds) + "s");
    return parts.join(" ") + " ago";
  }
}

function createEnhancedLayout(headerInfo, earthquakes) {
  const container = document.createElement("div");
  container.id = "rasathane-enhancer-container";

  const headerDiv = document.createElement("div");
  headerDiv.id = "rasathane-header-info";

  if (headerInfo.title) {
    const h1 = document.createElement("h1");
    h1.textContent = headerInfo.title;
    headerDiv.appendChild(h1);
  }
  if (headerInfo.subtitle) {
    const h2 = document.createElement("h2");
    h2.textContent = headerInfo.subtitle;
    headerDiv.appendChild(h2);
  }
  if (headerInfo.note) {
    const p = document.createElement("p");
    p.textContent = headerInfo.note;
    headerDiv.appendChild(p);
  }
  container.appendChild(headerDiv);

  const filterContainer = document.createElement("div");
  filterContainer.id = "rasathane-filter-container";

  const filterLabel = document.createElement("label");
  filterLabel.textContent = "Filter by Location (e.g., marmara, istanbul): ";
  filterLabel.htmlFor = "rasathane-location-filter";

  const filterInput = document.createElement("input");
  filterInput.type = "text";
  filterInput.id = "rasathane-location-filter";
  filterInput.placeholder = "Enter locations, separated by commas...";

  filterContainer.appendChild(filterLabel);
  filterContainer.appendChild(filterInput);
  container.appendChild(filterContainer);

  const table = document.createElement("table");
  table.id = "rasathane-earthquake-table";
  const thead = document.createElement("thead");
  const tbody = document.createElement("tbody");
  table.appendChild(thead);
  table.appendChild(tbody);

  const headerRow = document.createElement("tr");
  const headers = [
    "Tarih",
    "Saat",
    "Enlem(N)",
    "Boylam(E)",
    "Derinlik(km)",
    "MD",
    "ML",
    "Mw",
    "Yer",
    "Çözüm Niteliği",
    "Time Ago",
  ];
  headers.forEach((text) => {
    const th = document.createElement("th");
    th.textContent = text;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);

  earthquakes.forEach((eq) => {
    const row = document.createElement("tr");
    row.dataset.location = normalizeString(eq.location);

    const data = [
      eq.date,
      eq.time,
      eq.lat,
      eq.lon,
      eq.depth,
      eq.md,
      eq.ml,
      eq.mw,
      eq.location,
      eq.quality,
      timeAgo(eq.eventDate),
    ];

    data.forEach((text, index) => {
      const td = document.createElement("td");
      td.textContent = text;
      if ((index >= 4 && index <= 7) || index === 10) {
        td.style.textAlign = "center";
      }
      if (index === 8) {
        td.style.minWidth = "200px";
      }
      row.appendChild(td);
    });
    tbody.appendChild(row);
  });

  container.appendChild(table);

  filterInput.addEventListener("input", (event) => {
    const rawFilterValue = event.target.value;
    const normalizedFilterValue = normalizeString(rawFilterValue);

    const filterTerms = normalizedFilterValue
      .split(",")
      .map((term) => term.trim())
      .filter((term) => term);

    const rows = tbody.querySelectorAll("tr");
    rows.forEach((row) => {
      const locationData = row.dataset.location;
      let show = true;

      if (filterTerms.length > 0) {
        show = filterTerms.some((term) => locationData.includes(term));
      }

      row.style.display = show ? "" : "none";
    });
  });

  return container;
}

const preElement = document.querySelector("pre");

if (preElement && preElement.textContent) {
  console.log("Rasathane Enhancer: Found <pre> element. Parsing data...");
  try {
    const { headerInfo, earthquakes } = parseData(preElement.textContent);

    if (earthquakes.length > 0) {
      console.log(
        `Rasathane Enhancer: Parsed ${earthquakes.length} earthquakes.`,
      );
      const enhancedLayout = createEnhancedLayout(headerInfo, earthquakes);

      preElement.parentNode.replaceChild(enhancedLayout, preElement);

      console.log("Rasathane Enhancer: Enhanced layout created and inserted.");
    } else {
      console.warn(
        "Rasathane Enhancer: No earthquake data found after parsing.",
      );
    }
  } catch (error) {
    console.error("Rasathane Enhancer: Error processing data:", error);
  }
} else {
  console.warn(
    "Rasathane Enhancer: Could not find the <pre> element on the page.",
  );
}

// Form fields for the block tabs. buildField() makes the DOM for a field
// definition, collectValue() reads it back into the plain value a block's
// generateHTML() receives. To add a field type, handle it in BOTH functions
// and list it in docs/ADDING-A-BLOCK.md.
import { openLinkDialog } from "./link-dialog.js";
import { cleanQuillHTML } from "../lib/richtext.js";


export function buildField(field) {
  const wrap = document.createElement("div");
  wrap.className = "field";
  wrap.dataset.fieldId = field.id;

  if (field.label) {
    const label = document.createElement("label");
    label.textContent = field.label;
    wrap.appendChild(label);
  }

  if (field.type === "text") {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "text-field-input";
    input.placeholder = field.placeholder || "";
    wrap.appendChild(input);
  }

  else if (field.type === "bullet-list") {
    const rowsContainer = document.createElement("div");
    rowsContainer.className = "bullet-rows";
    wrap.appendChild(rowsContainer);

    function addRow(value) {
      const row = document.createElement("div");
      row.className = "bullet-row";
      const input = document.createElement("input");
      input.type = "text";
      input.value = value || "";
      input.placeholder = field.itemPlaceholder || "Bullet text";
      const remove = document.createElement("button");
      remove.className = "bullet-remove";
      remove.type = "button";
      remove.textContent = "×";
      remove.setAttribute("aria-label", "Remove bullet");
      remove.onclick = () => row.remove();
      row.appendChild(input);
      row.appendChild(remove);
      rowsContainer.appendChild(row);
    }

    for (let i = 0; i < field.defaultCount; i++) addRow("");

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "bullet-add";
    addBtn.textContent = field.addLabel || "+ Add bullet";
    addBtn.onclick = () => addRow("");
    wrap.appendChild(addBtn);
  }

  else if (field.type === "select") {
    const select = document.createElement("select");
    field.options.forEach(opt => {
      const o = document.createElement("option");
      o.value = opt.value;
      o.textContent = opt.label;
      if (opt.value === field.default) o.selected = true;
      select.appendChild(o);
    });
    wrap.appendChild(select);
  }

  else if (field.type === "media-picker") {
    const select = document.createElement("select");
    select.className = "media-type-select";
    const typeOptions = [["image", "Image"], ["video", "Video embed"]];
    if (field.allowOther) typeOptions.push(["other", "Another content block"]);
    if (field.allowNone !== false) typeOptions.push(["none", "None"]);
    typeOptions.forEach(([val, txt]) => {
      const o = document.createElement("option");
      o.value = val;
      o.textContent = txt;
      select.appendChild(o);
    });
    wrap.appendChild(select);

    const imageGroup = document.createElement("div");
    imageGroup.className = "subfield media-image-group";
    imageGroup.innerHTML = `
      <label>Image URL</label>
      <input type="text" class="media-image-url" placeholder="https://..." />
      <label style="margin-top:0.6rem;">Alt text</label>
      <input type="text" class="media-image-alt" placeholder="Leave blank for decorative images" />
      <p class="field-help">Only describe the image if it's needed to understand the content. Purely decorative images should be left blank.</p>
      ${field.allowSize ? `<label style="margin-top:0.6rem;">Image size</label>
      <select class="media-image-size">
        <option value="standard">Standard</option>
        <option value="large">Large (e.g. a badge or certificate graphic)</option>
      </select>` : ""}`;
    wrap.appendChild(imageGroup);

    const videoGroup = document.createElement("div");
    videoGroup.className = "subfield media-video-group";
    videoGroup.innerHTML = `
      <label>YouTube URL or video ID</label>
      <input type="text" class="media-video-url" placeholder="https://youtube.com/watch?v=... or the video ID" />`;
    wrap.appendChild(videoGroup);

    function updateVisibility() {
      imageGroup.style.display = select.value === "image" ? "block" : "none";
      videoGroup.style.display = select.value === "video" ? "block" : "none";
    }
    select.addEventListener("change", updateVisibility);
    updateVisibility();
  }

  else if (field.type === "rich-text") {
    const editorContainer = document.createElement("div");
    editorContainer.className = "rich-text-editor";
    wrap.appendChild(editorContainer);

    // Most rich-text fields get the full toolbar; a field can opt into
    // a restricted one (e.g. "minimal" = bold only) via field.toolbar.
    const toolbarConfig = field.toolbar === "minimal"
      ? [["bold"], ["clean"]]
      : [
          [{ header: [3, false] }],
          ["bold", "italic"],
          [{ list: "ordered" }, { list: "bullet" }],
          ["link"],
          ["clean"]
        ];
    const hasLinkButton = toolbarConfig.some(group => group.includes("link"));

    const quill = new Quill(editorContainer, {
      theme: "snow",
      placeholder: field.placeholder || "",
      modules: {
        toolbar: {
          container: toolbarConfig,
          handlers: hasLinkButton ? { link: () => openLinkDialog(quill) } : {}
        }
      }
    });

    // Strip everything from pasted content except the formats this
    // editor's own toolbar actually offers — guards against Word/Outlook
    // paste junk (fonts, colours, inline styles), and stops the minimal
    // (bold-only) toolbar from gaining a heading or list via paste that
    // its own buttons don't offer.
    const allowedPasteFormats = field.toolbar === "minimal"
      ? ["bold"]
      : ["bold", "italic", "link", "header", "list"];
    quill.clipboard.addMatcher(Node.ELEMENT_NODE, (node, delta) => {
      delta.ops.forEach(op => {
        if (op.attributes) {
          Object.keys(op.attributes).forEach(key => {
            if (!allowedPasteFormats.includes(key)) delete op.attributes[key];
          });
        }
      });
      return delta;
    });

    wrap._quillInstance = quill;
  }

  else if (field.type === "button-items") {
    const itemsContainer = document.createElement("div");
    itemsContainer.className = "item-cards";
    wrap.appendChild(itemsContainer);

    function addItem() {
      const card = document.createElement("div");
      card.className = "item-card";
      card.innerHTML = `
        <div class="item-card-header">
          <span class="item-card-title">Button</span>
          <button type="button" class="item-remove">Remove</button>
        </div>
        <label>Label</label>
        <input type="text" class="btn-label" placeholder="e.g. Sign the pledge" />
        <label style="margin-top:0.6rem;">URL</label>
        <input type="text" class="btn-url" placeholder="https://..." />
        <label style="margin-top:0.8rem; display:flex; align-items:center; gap:0.5rem; font-weight:500; cursor:pointer;">
          <input type="checkbox" class="btn-new-tab" style="width:auto;" checked />
          Open in a new tab
        </label>`;
      card.querySelector(".item-remove").onclick = () => card.remove();
      itemsContainer.appendChild(card);
    }

    for (let i = 0; i < field.defaultCount; i++) addItem();

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "item-add";
    addBtn.textContent = "+ Add button";
    addBtn.onclick = () => addItem();
    wrap.appendChild(addBtn);
  }

  else if (field.type === "nav-card-items") {
    const styleField = document.createElement("div");
    styleField.className = "field";
    styleField.innerHTML = `<label>Card style</label>`;
    const styleSelect = document.createElement("select");
    styleSelect.className = "navcard-style-select";
    [["standard", "Icon + description + button"], ["numbered", "Numbered heading + icon (no button)"]].forEach(([val, txt]) => {
      const o = document.createElement("option");
      o.value = val;
      o.textContent = txt;
      styleSelect.appendChild(o);
    });
    styleField.appendChild(styleSelect);
    wrap.appendChild(styleField);

    const autoNumberLabel = document.createElement("label");
    autoNumberLabel.style.cssText = "display:none; align-items:center; gap:0.5rem; font-weight:500; cursor:pointer; margin-bottom:1rem;";
    autoNumberLabel.innerHTML = `<input type="checkbox" class="navcard-auto-number" style="width:auto;" checked /> Number the cards automatically (1, 2, 3...)`;
    wrap.appendChild(autoNumberLabel);

    const itemsContainer = document.createElement("div");
    itemsContainer.className = "item-cards";
    wrap.appendChild(itemsContainer);

    function updateCardVisibility(card) {
      const style = styleSelect.value;
      card.querySelector(".navcard-standard-fields").style.display = style === "standard" ? "block" : "none";
      card.querySelector(".navcard-numbered-fields").style.display = style === "numbered" ? "block" : "none";
    }

    function updateAllVisibility() {
      itemsContainer.querySelectorAll(".item-card").forEach(updateCardVisibility);
      autoNumberLabel.style.display = styleSelect.value === "numbered" ? "flex" : "none";
    }

    styleSelect.addEventListener("change", updateAllVisibility);

    function addItem() {
      const card = document.createElement("div");
      card.className = "item-card";
      card.innerHTML = `
        <div class="item-card-header">
          <span class="item-card-title">Card</span>
          <button type="button" class="item-remove">Remove</button>
        </div>
        <label>Icon image URL (transparent PNG — colours are part of the image itself)</label>
        <input type="text" class="navcard-icon-url" placeholder="https://..." />
        <label style="margin-top:0.6rem;">Icon alt text</label>
        <input type="text" class="navcard-icon-alt" placeholder="Usually blank — the text already says what it does" />
        <div class="navcard-standard-fields">
          <label style="margin-top:0.6rem;">Description</label>
          <textarea class="navcard-description" rows="2" placeholder="Short, one or two lines"></textarea>
          <label style="margin-top:0.6rem;">Button label</label>
          <input type="text" class="navcard-button-label" placeholder="e.g. Understand it" />
        </div>
        <div class="navcard-numbered-fields" style="display:none;">
          <label style="margin-top:0.6rem;">Heading</label>
          <textarea class="navcard-heading" rows="2" placeholder="e.g. Agree direction and ensure alignment and commitment"></textarea>
        </div>
        <label style="margin-top:0.6rem;">Link URL (the button in standard style, the whole card in numbered style)</label>
        <input type="text" class="navcard-url" placeholder="https://..." />
        <label style="margin-top:0.8rem; display:flex; align-items:center; gap:0.5rem; font-weight:500; cursor:pointer;">
          <input type="checkbox" class="navcard-new-tab" style="width:auto;" />
          Open in a new tab
        </label>`;
      card.querySelector(".item-remove").onclick = () => card.remove();
      itemsContainer.appendChild(card);
      updateCardVisibility(card);
    }

    for (let i = 0; i < field.defaultCount; i++) addItem();

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "item-add";
    addBtn.textContent = "+ Add card";
    addBtn.onclick = () => addItem();
    wrap.appendChild(addBtn);

    wrap._navCardStyleSelect = styleSelect;
    wrap._navCardAutoNumber = autoNumberLabel.querySelector(".navcard-auto-number");
  }

  else if (field.type === "resource-card-items") {
    const itemsContainer = document.createElement("div");
    itemsContainer.className = "item-cards";
    wrap.appendChild(itemsContainer);

    function addItem() {
      const card = document.createElement("div");
      card.className = "item-card";
      card.innerHTML = `
        <div class="item-card-header">
          <span class="item-card-title">Card</span>
          <button type="button" class="item-remove">Remove</button>
        </div>
        <label>Image URL</label>
        <input type="text" class="card-image-url" placeholder="https://..." />
        <label style="margin-top:0.6rem;">Image alt text</label>
        <input type="text" class="card-image-alt" placeholder="Leave blank for decorative images" />
        <label style="margin-top:0.6rem;">Title</label>
        <input type="text" class="card-title" placeholder="Resource title" />
        <label style="margin-top:0.6rem;">Link URL</label>
        <input type="text" class="card-link-url" placeholder="https://..." />
        <label style="margin-top:0.8rem; display:flex; align-items:center; gap:0.5rem; font-weight:500; cursor:pointer;">
          <input type="checkbox" class="card-new-tab" style="width:auto;" checked />
          Open in a new tab
        </label>
        <label style="margin-top:0.6rem;">Type</label>
        <input type="text" class="card-type" placeholder="e.g. Video, Publication, Course" />
        <label style="margin-top:0.6rem;">Duration / length (optional)</label>
        <input type="text" class="card-duration" placeholder="e.g. 36 Minutes, Long Read — leave blank to omit" />`;
      card.querySelector(".item-remove").onclick = () => card.remove();
      itemsContainer.appendChild(card);
    }

    for (let i = 0; i < field.defaultCount; i++) addItem();

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "item-add";
    addBtn.textContent = "+ Add card";
    addBtn.onclick = () => addItem();
    wrap.appendChild(addBtn);
  }

  else if (field.type === "icon-toggle-items") {
    const itemsContainer = document.createElement("div");
    itemsContainer.className = "item-cards";
    wrap.appendChild(itemsContainer);

    function addItem() {
      const card = document.createElement("div");
      card.className = "item-card";
      card.innerHTML = `
        <div class="item-card-header">
          <span class="item-card-title">Item</span>
          <button type="button" class="item-remove">Remove</button>
        </div>
        <label>Icon image URL</label>
        <input type="text" class="icon-url" placeholder="https://..." />
        <label style="margin-top:0.6rem;">Icon alt text</label>
        <input type="text" class="icon-alt" placeholder="Leave blank for decorative images" />
        <label style="margin-top:0.6rem;">Label</label>
        <input type="text" class="icon-label" placeholder="Shown under the icon" />
        <label style="margin-top:0.8rem; display:flex; align-items:center; gap:0.5rem; font-weight:500; cursor:pointer;">
          <input type="checkbox" class="separate-image-toggle" style="width:auto;" />
          Use a separate image in the content panel
        </label>
        <div class="subfield separate-image-group" style="display:none;">
          <label>Content panel image URL</label>
          <input type="text" class="panel-image-url" placeholder="https://..." />
        </div>`;
      card.querySelector(".item-remove").onclick = () => card.remove();
      const checkbox = card.querySelector(".separate-image-toggle");
      const group = card.querySelector(".separate-image-group");
      checkbox.addEventListener("change", () => {
        group.style.display = checkbox.checked ? "block" : "none";
      });
      itemsContainer.appendChild(card);
    }

    for (let i = 0; i < field.defaultCount; i++) addItem();

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "item-add";
    addBtn.textContent = "+ Add item";
    addBtn.onclick = () => addItem();
    wrap.appendChild(addBtn);
  }

  else if (field.type === "item-list") {
    const itemsContainer = document.createElement("div");
    itemsContainer.className = "item-cards";
    wrap.appendChild(itemsContainer);

    function addItem() {
      const card = document.createElement("div");
      card.className = "item-card";
      card.innerHTML = `
        <div class="item-card-header">
          <span class="item-card-title">Item</span>
          <button type="button" class="item-remove">Remove</button>
        </div>
        <label>Heading</label>
        <input type="text" class="item-heading" placeholder="Heading text (number is added automatically)" />
        <label style="margin-top:0.6rem;">Content — one line per ${itemsContainer.dataset.formatHint || "list item / paragraph"}</label>
        <textarea class="item-content-textarea" rows="3" placeholder="One line per point"></textarea>`;
      card.querySelector(".item-remove").onclick = () => card.remove();
      itemsContainer.appendChild(card);
    }

    for (let i = 0; i < field.defaultCount; i++) addItem();

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "item-add";
    addBtn.textContent = "+ Add item";
    addBtn.onclick = () => addItem();
    wrap.appendChild(addBtn);
  }

  return wrap;
}

export function collectValue(wrap, field) {
  if (field.type === "text") {
    return wrap.querySelector(".text-field-input").value;
  }
  if (field.type === "bullet-list") {
    return Array.from(wrap.querySelectorAll(".bullet-row input")).map(i => i.value);
  }
  if (field.type === "select") {
    return wrap.querySelector("select").value;
  }
  if (field.type === "media-picker") {
    const type = wrap.querySelector(".media-type-select").value;
    const sizeEl = wrap.querySelector(".media-image-size");
    return {
      type,
      imageUrl: wrap.querySelector(".media-image-url").value,
      imageAlt: wrap.querySelector(".media-image-alt").value,
      imageSize: sizeEl ? sizeEl.value : "standard",
      videoUrl: wrap.querySelector(".media-video-url").value
    };
  }
  if (field.type === "rich-text") {
    return cleanQuillHTML(wrap._quillInstance.root.innerHTML);
  }
  if (field.type === "button-items") {
    return Array.from(wrap.querySelectorAll(".item-card")).map(card => ({
      label: card.querySelector(".btn-label").value,
      url: card.querySelector(".btn-url").value,
      newTab: card.querySelector(".btn-new-tab").checked
    }));
  }
  if (field.type === "nav-card-items") {
    const cards = Array.from(wrap.querySelectorAll(".item-card")).map(card => ({
      iconUrl: card.querySelector(".navcard-icon-url").value,
      iconAlt: card.querySelector(".navcard-icon-alt").value,
      description: card.querySelector(".navcard-description").value,
      buttonLabel: card.querySelector(".navcard-button-label").value,
      buttonUrl: card.querySelector(".navcard-url").value,
      newTab: card.querySelector(".navcard-new-tab").checked,
      heading: card.querySelector(".navcard-heading").value,
      targetUrl: card.querySelector(".navcard-url").value
    }));
    return {
      style: wrap._navCardStyleSelect.value,
      autoNumber: wrap._navCardAutoNumber.checked,
      cards
    };
  }
  if (field.type === "resource-card-items") {
    return Array.from(wrap.querySelectorAll(".item-card")).map(card => ({
      imageUrl: card.querySelector(".card-image-url").value,
      imageAlt: card.querySelector(".card-image-alt").value,
      title: card.querySelector(".card-title").value,
      linkUrl: card.querySelector(".card-link-url").value,
      newTab: card.querySelector(".card-new-tab").checked,
      type: card.querySelector(".card-type").value,
      duration: card.querySelector(".card-duration").value
    }));
  }
  if (field.type === "icon-toggle-items") {
    return Array.from(wrap.querySelectorAll(".item-card")).map(card => ({
      iconUrl: card.querySelector(".icon-url").value,
      iconAlt: card.querySelector(".icon-alt").value,
      label: card.querySelector(".icon-label").value,
      separateImage: card.querySelector(".separate-image-toggle").checked,
      panelImageUrl: card.querySelector(".panel-image-url").value
    }));
  }
  if (field.type === "item-list") {
    return Array.from(wrap.querySelectorAll(".item-card")).map(card => ({
      heading: card.querySelector(".item-heading").value,
      content: card.querySelector(".item-content-textarea").value
    }));
  }
  return null;
}

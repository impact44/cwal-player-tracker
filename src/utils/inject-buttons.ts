export function injectAkaButtons(
  container: HTMLElement,
  onAdd: (aka: string) => void,
  onRemove: () => void
): void {
  if (container.querySelector("#aka-action-buttons")) return;

  const wrapper = document.createElement("div");
  wrapper.id = "aka-action-buttons";
  wrapper.className = "flex flex-row gap-2 items-center";
  wrapper.style.marginRight = "auto";

  // Buttons
  const addButton = document.createElement("button");
  addButton.className = "btn btn-xs btn-primary";
  addButton.textContent = "Add to List";

  const removeButton = document.createElement("button");
  removeButton.className = "btn btn-xs btn-primary";
  removeButton.textContent = "Remove from List";

  const confirmButton = document.createElement("button");
  confirmButton.className = "btn btn-xs btn-success";
  confirmButton.textContent = "Confirm";
  confirmButton.style.display = "none";

  const cancelButton = document.createElement("button");
  cancelButton.className = "btn btn-xs btn-success";
  cancelButton.textContent = "Cancel";
  cancelButton.style.display = "none";

  // Input box
  const akaInput = document.createElement("input");
  akaInput.type = "text";
  akaInput.placeholder = "Enter an alias";
  akaInput.className = "input input-xs input-bordered w-28";
  akaInput.style.display = "none";
  akaInput.style.paddingTop = "0";
  akaInput.style.paddingBottom = "0";
  akaInput.style.height = "auto";

  // Add click behavior
  addButton.onclick = () => {
    addButton.style.display = "none";
    removeButton.style.display = "none";
    akaInput.style.display = "inline-block";
    confirmButton.style.display = "inline-block";
    cancelButton.style.display = "inline-block";
    akaInput.focus();
  };

  // Cancel click behavior
  cancelButton.onclick = () => {
    akaInput.value = "";
    akaInput.style.display = "none";
    confirmButton.style.display = "none";
    cancelButton.style.display = "none";
    addButton.style.display = "inline-block";
    removeButton.style.display = "inline-block";
  };

  // Confirm click behavior
  confirmButton.onclick = () => {
    const aka = akaInput.value.trim();
    if (!aka) {
      alert("Please enter a name.");
      return;
    }

    onAdd(aka);
    akaInput.value = "";
    akaInput.style.display = "none";
    confirmButton.style.display = "none";
    cancelButton.style.display = "none";
    addButton.style.display = "inline-block";
    removeButton.style.display = "inline-block";
  };

  // Remove click
  removeButton.onclick = onRemove;

  // Add all elements to DOM
  wrapper.appendChild(addButton);
  wrapper.appendChild(removeButton);
  wrapper.appendChild(akaInput);
  wrapper.appendChild(confirmButton);
  wrapper.appendChild(cancelButton);

  container.insertBefore(wrapper, container.firstChild);
}

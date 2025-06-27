/**
 * Adds or updates an aka entry in chrome.storage.local under "pro_map"
 */
export function addAkaToStorage(
  aka: string,
  auroraId: number,
  battleTag: string
): void {
  chrome.storage.local.get("pro_map", (result) => {
    const map = result.pro_map as Record<string, { aurora_id: number; battle_tag: string }> ?? {};

    // Prevent duplicates: check if aurora_id is already stored under a different aka
    const duplicateEntry = Object.entries(map).find(
      ([, info]) => info.aurora_id === auroraId
    );

    if (duplicateEntry) {
      const [existingAka] = duplicateEntry;
      alert(`This player is already on the list as: ${existingAka}`);
      return;
    }

    // Proceed with adding
    map[aka] = {
      aurora_id: auroraId,
      battle_tag: battleTag,
    };

    chrome.storage.local.set({ pro_map: map }, () => {
      console.log(
        `[EXT] Added ${aka} to list, aurora_id: ${auroraId}, battle_tag: ${battleTag}`
      );
    });
  });
}

/**
 * Removes an aka entry from chrome.storage.local under "pro_map"
 */
export function removeAkaFromStorage(auroraId: number): void {
  chrome.storage.local.get("pro_map", (result) => {
    const map = result.pro_map as Record<string, { aurora_id: number; battle_tag: string }> ?? {};

    const akaToRemove = Object.entries(map).find(
      ([, info]) => info.aurora_id === auroraId
    )?.[0];

    if (akaToRemove) {
      delete map[akaToRemove];

      chrome.storage.local.set({ pro_map: map }, () => {
        console.log(`[EXT] Removed from pro list: ${akaToRemove}, aurora_id: ${auroraId}`);
      });
    } else {
      console.log(`[EXT] ⚠️ Player was already not on the list`);
    }
  });
}

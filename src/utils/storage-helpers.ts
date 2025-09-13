import browser from 'webextension-polyfill';
/**
 * Adds or updates an aka entry in browser/chrome.storage.local under "aka_list"
 */
export function addAkaToStorage(aka: string, auroraId: number, battleTag: string): void {
  browser.storage.local.get("aka_list").then((result: any) => {
    const map = result.aka_list as Record<
      string,
      { aurora_id: number; battle_tag: string }[]
    > ?? {};

    // Prevent duplicates across all aliases
    const duplicate = Object.entries(map).find(([_, accounts]) =>
      accounts.some((acc) => acc.aurora_id === auroraId)
    );

    if (duplicate) {
      const [existingAka] = duplicate;
      alert(`This player is already on the list as: ${existingAka}`);
      return;
    }

    if (!map[aka]) map[aka] = [];

    map[aka].push({ aurora_id: auroraId, battle_tag: battleTag });

    browser.storage.local.set({ aka_list: map }).then(() => {
      console.log(
        `[EXT] Added ${aka} → aurora_id: ${auroraId}, battle_tag: ${battleTag}`
      );
    });
  });
}

/**
 * Removes an account from aka_list by auroraId
 */
export function removeAkaFromStorage(auroraId: number): void {
  browser.storage.local.get("aka_list").then((result: any) => {
    const map = result.aka_list as Record<
      string,
      { aurora_id: number; battle_tag: string }[]
    > ?? {};

    let found = false;

    for (const [aka, accounts] of Object.entries(map)) {
      const updated = accounts.filter((acc) => acc.aurora_id !== auroraId);
      if (updated.length !== accounts.length) {
        found = true;
        if (updated.length > 0) {
          map[aka] = updated;
        } else {
          delete map[aka];
        }
        browser.storage.local.set({ aka_list: map }).then(() => {
          console.log(`[EXT] Removed from list: ${aka}, aurora_id: ${auroraId}`);
        });
        break;
      }
    }

    if (!found) {
      console.log(`[EXT] ⚠️ Player was already not on the list`);
    }
  });
}

export async function exportAkaList(): Promise<void> {
  return new Promise((resolve) => {
    browser.storage.local.get('aka_list').then((result: any) => {
      const akaList = result.aka_list;

      if (!akaList) {
        console.warn('❌ aka_list not found in storage.');
        return;
      }

      const jsonStr = JSON.stringify(akaList, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = 'aka_list.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      URL.revokeObjectURL(url);
      resolve();
    });
  });
}

export async function importAkaList(): Promise<void> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        reject('No file selected');
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const text = event.target?.result as string;
          const parsed = JSON.parse(text);

          // Optional: validate structure
          if (typeof parsed !== 'object' || parsed === null) {
            throw new Error('Invalid JSON structure');
          }

          browser.storage.local.set({ aka_list: parsed }).then(() => {
            console.log('[EXT] List imported successfully');
            resolve();
          });
        } catch (err) {
          reject(err);
        }
      };

      reader.onerror = () => {
        reject(reader.error);
      };

      reader.readAsText(file);
    };

    input.click();
  });
}

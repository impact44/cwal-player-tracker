import { useState} from "react";

const AliasEditor: React.FC = () => {
  const initialAlias = "Ample"; // or get from props later

  const [alias, setAlias] = useState(initialAlias);
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState(alias);

  const save = () => {
    setAlias(inputValue);
    setEditing(false);
    console.log("Saved alias:", inputValue);
  };

  return editing ? (
    <span style={{ marginLeft: "8px" }}>
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
        }}
        style={{ fontSize: "1rem", padding: "2px" }}
      />
    </span>
  ) : (
    <span
      style={{ marginLeft: "8px", cursor: "pointer" }}
      title="Edit alias"
      onClick={() => setEditing(true)}
    >
      <img src={chrome.runtime.getURL("icons/edit-icon.png")} className="ml-2 cursor-pointer w-4 h-4" />
    </span>
  );
};

export default AliasEditor;

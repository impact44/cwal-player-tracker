import { useState, useEffect } from 'react'

const ViewListPanel = () => {
    const [akaList, setAkaList] = useState<Record<string, { battle_tag: string; aurora_id: number }[]>>({})
    const [aliasCount, setAliasCount] = useState(0)

    useEffect(() => {
        chrome.storage.local.get('aka_list', (result) => {
            const list = result.aka_list || {}
            setAkaList(list)
            setAliasCount(Object.keys(list).length)
        })
    }, [])

    return (
        <div className="view-list-container">
            <div className="list-meta">
                There {aliasCount === 1 ? 'is' : 'are'} {aliasCount} alias{aliasCount === 1 ? '' : 'es'} on your list
            </div>

            <div className="alias-list-header grid-row">
                <span className="alias-col header">Alias</span>
                <span className="btag-col header">BattleTag</span>
                <span className="id-col header">Aurora ID</span>
            </div>

            <div className="alias-scroll">
                {Object.entries(akaList).map(([alias, accounts]) =>
                    accounts.map((acct, index) => (
                        <div key={`${alias}-${index}`} className="grid-row alias-row">
                            <span className="alias-col">{index === 0 ? alias : ''}</span>
                            <span className="btag-col">{acct.battle_tag}</span>
                            <span className="id-col">#{acct.aurora_id}</span>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}

export default ViewListPanel

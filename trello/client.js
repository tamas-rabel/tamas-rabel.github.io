async function on_parent(context)
{
    context.popup(
    {
        title: 'Parent',
        items: async function(t, options)
        {
            return await t.cards('id', 'name', 'cover').then(function(cards)
            {
                let result = []
                for (let c=0; c<cards.length; c++)
                {
                    if (!cards[c].name.toLowerCase().includes(options.search.toLowerCase())) continue;
                    
                    result.push(
                    {
                        text: cards[c].name,
                        callback: function(t)
                        {
                            t.set('card', 'shared', 'mb-parent', cards[c].id).then
                            {
                                t.closePopup();
                            }
                        },
                    });
                }
                
                return result;
            });
        },
        search:
        {
            count: 10,
            placeholder: 'Search cards',
            empty: 'No cards found',
        }
    });
}

async function on_add_blocker(context)
{
    context.popup(
    {
        title: 'Blocked by',
        items: async function(t, options)
        {
            return await t.cards('id', 'name', 'cover').then(function(cards)
            {
                let result = []
                for (let c=0; c<cards.length; c++)
                {
                    if (!cards[c].name.toLowerCase().includes(options.search.toLowerCase())) continue;
                    
                    result.push(
                    {
                        text: cards[c].name,
                        callback: function(t)
                        {
                            t.get('card', 'shared', 'mb-blocked-by', []).then((blocked_by) =>
                            {
                                blocked_by.push(cards[c].id);
                                t.set('card', 'shared', 'mb-blocked-by', blocked_by);
                            }).then(() =>
                            {
                                console.log("Adding blocks")
                                console.log(cards[c].id)
                                t.get(cards[c].id, 'shared', 'mb-blocks', []).then((blocks) =>
                                {
                                    blocks.push(card.id)
                                    console.log(blocks)
                                    t.set(cards[c].id, 'shared', 'mb-blocks', blocks).then
                                    {
                                        t.closePopup();
                                    }
                                });
                            });
                        },
                    });
                }
                
                return result;
            });
        },
        search:
        {
            count: 10,
            placeholder: 'Search cards',
            empty: 'No cards found',
        }
    });
}

g_valid_colours = ['blue', 'green', 'orange', 'red', 'yellow', 'purple', 'pink', 'sky', 'lime', 'light-gray'];

TrelloPowerUp.initialize(
{
    'card-badges': function(t, options)
    {
        return t.card('id', 'checklists').then(async function (card)
        {
            let result = [];
            for (let c=0; c<card.checklists.length; c++)
            {
                await t.getRestApi()
                .getToken()
                .then(async function(token)
                {
                    await fetch('https://api.trello.com/1/checklists/' + card.checklists[c].id + '/checkItems?key=2673af39e812244706daa1292a259359&token='+token)
                    .then((response) => response.json())
                    .then((items) =>
                    {
                        let num_done = 0;
                        for (let i=0; i<items.length; i++)
                        {
                            let done = (items[i].state == 'complete');
                            if (done) num_done++;
                            result.push({text: (done ? '☑ ' : '☐ ') + items[i].name});
                        }
                        result.unshift({color: 'light-gray', text: (num_done + "/" + items.length + " " + card.checklists[c].name + "                                                                                                    ")});
                    });
                });
            }

            await t.cards('id', 'name', 'cover').then(async function(cards)
            {
                let parent = await t.get('card', 'shared', 'mb-parent', null);
                if (parent != null)
                {
                    card = cards.find((c) => c.id == parent)
                    if (card != null)
                    {
                        let colour = card.cover.color;
                        if (colour == null || !g_valid_colours.includes(colour)) colour = "light-gray";
                        result.unshift({color: colour, text: card.name});
                    }
                }
            });
            
            return result;
        });
    },
    'board-buttons': function (t, opts)
    {
        return [
        {
            text: 'mb',
            callback: function(t, options)
            {
                return t.popup(
                {
                    title: 'Authorize to continue',
                    url: './authorize.html'
                });                
            },
        }];
    },
    'card-buttons': function(t, options)
    {
        return [
        {
            icon: "https://cdn.hyperdev.com/us-east-1%3A3d31b21c-01a0-4da2-8827-4bc6e88b7618%2Ficon-gray.svg",
            text: 'Set parent',
            callback: on_parent,
            condition: 'edit'
        },
        {
            icon: "https://cdn.hyperdev.com/us-east-1%3A3d31b21c-01a0-4da2-8827-4bc6e88b7618%2Ficon-gray.svg",
            text: 'Add blocker',
            callback: on_add_blocker,
            condition: 'edit'
        },
        ];
    },
    'card-back-section': async function (t, opts)
    {
        console.log("Checking parent")
        let result = []
        let parent = await t.get('card', 'shared', 'mb-parent', null).then(function(parent)
        {
            console.log(parent)
            if (parent == null)
            {
                return [];
            }
            
            return [
            {
                title: "Parent",
                icon: 'https://cdn.hyperdev.com/us-east-1%3A3d31b21c-01a0-4da2-8827-4bc6e88b7618%2Ficon-gray.svg',
                content:
                {
                    type: 'iframe',
                    url: t.signUrl('./parent-section.html'),
                    height: 128,
                }
            }];
        });
        console.log(typeof(parent));
        console.log(parent);
        result = result.concat(parent);
        console.log(result);
        console.log("Checking blocks")
        let blocks = await t.get('card', 'shared', 'mb-blocks', []).then(function(blocks)
        {
            console.log(blocks)
            if (blocks.length == 0)
            {
                return [];
            }
            
            return [
            {
                title: "Blocking",
                icon: 'https://cdn.hyperdev.com/us-east-1%3A3d31b21c-01a0-4da2-8827-4bc6e88b7618%2Ficon-gray.svg',
                content:
                {
                    type: 'iframe',
                    url: t.signUrl('./blocking-section.html'),
                    height: 128,
               }
            }];
        });
        result = result.concat(blocks);
        console.log("Checking blocked by")
        let blocked_by = await t.get('card', 'shared', 'mb-blocked-by', []).then(function(blocked_by)
        {
            console.log(blocked_by)
            if (blocked_by.length == 0)
            {
                return [];
            }
            
            return [
            {
                title: "Blocked by",
                icon: 'https://cdn.hyperdev.com/us-east-1%3A3d31b21c-01a0-4da2-8827-4bc6e88b7618%2Ficon-gray.svg',
                content:
                {
                    type: 'iframe',
                    url: t.signUrl('./blocked-section.html'),
                    height: 128,
                }
            }];
        });
        result = result.concat(blocked_by)
        
        console.log(result);
        
        return result;
    },
},
{
    appKey: '2673af39e812244706daa1292a259359',
    appName: 'mb'
});

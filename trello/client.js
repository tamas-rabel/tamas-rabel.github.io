async function on_subtask(t, options)
{
    let orig_t = t;
    return t.popup(
    {
        title: 'Add subtask',
        items: async function(t, options)
        {
            return await t.cards('id', 'name', 'cover').then(function(cards)
            {
                //console.log(cards);
                let result = []
                for (let c=0; c<cards.length; c++)
                {
                    if (!cards[c].name.toLowerCase().includes(options.search.toLowerCase())) continue;
                    
                    result.push(
                    {
                        text: cards[c].name,
                        callback: function(t, opts)
                        {
                            t.get('card', 'shared', 'mb-subtasks', []).then(function(subtasks)
                            {
                                subtasks.push(cards[c].id);
                                t.set('card', 'shared', 'mb-subtasks', subtasks);
                            });
                        },
                    });
                }
                
                orig_t.closePopup();
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
                let subtasks = await t.get('card', 'shared', 'mb-subtasks', []);
                for (let s=0; s<subtasks.length; s++)
                {
                    card = cards.find((c) => c.id == subtasks[s])
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
            text: 'Add subtask',
            callback: on_subtask,
            condition: 'edit'
        }];
    },
},
{
    appKey: '2673af39e812244706daa1292a259359',
    appName: 'mb'
});

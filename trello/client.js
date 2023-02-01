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
                .then(function(token)
                {
                    fetch('https://api.trello.com/1/checklists/' + card.checklists[c].id + '/checkItems?key=2673af39e812244706daa1292a259359&token='+token)
                    .then((response) => response.json())
                    .then((items) =>
                    {
                        result.push({color: 'light-gray', text: card.checklists[c].name});
                        for (let i=0; i<items.length; i++)
                        {
                            result.push({text: ((items[i].state == 'complete') ? '☐ ' : '☑ ') + items[i].name});
                        }
                    });
                    console.log("Result done");
                });
            }
            
            if (card.checklists.length > 0)
            {
                console.log("RETURNING");
                console.log(result);
            }
            
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
},
{
    appKey: '2673af39e812244706daa1292a259359',
    appName: 'mb'
});

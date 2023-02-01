TrelloPowerUp.initialize(
{
    'card-badges': function(t, options)
    {        
        t.card('id', 'checklists').then(function (card)
        {
            for (let c=0; c<card.checklists.length; c++)
            {
                console.log(card.checklists[c])
                
                t.getRestApi()
                .getToken()
                .then(function(token)
                {
                    fetch('https://api.trello.com/1/checklists/' + card.checklists[c].id + '/checkItems?key=2673af39e812244706daa1292a259359&token='+token)
                    .then((response) => response.json())
                    .then((items) =>
                    {
                        console.log(items)
                        console.log(items.length)
                        
                        let lines = [];
                        lines.push({color: 'light-gray', text: card.checklists[c].name});
                        for (let i=0; i<items.length; i++)
                        {
                            lines.push({text: ((items[i].state == 'complete') ? '☐ ' : '☐ ') + items[i].name});
                        }
                        
                        console.log(lines)
                        
                        return lines;
                    });
                });
            }
        });

        return [];
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

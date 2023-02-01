TrelloPowerUp.initialize(
{
    'card-badges': function(t, options)
    {        
        t.card('id', 'checklists').then(function (card)
        {
            if (card.checklists.length > 0)
            {
                t.getRestApi()
                .getToken()
                .then(function(token)
                {
                    fetch('https://api.trello.com/1/checklists/' + card.checklists[0].id + '/checkItems?key=2673af39e812244706daa1292a259359&token='+token);
                    .then((response) => response.json())
                    .then((json) => console.log(json));
                });
            }
        });

        return [
        {
            color: 'light-gray',
            text: '1/2 Initial spike',
        },
        {
            text: '☐ Peer to peer vs client-server?',
        },
        {
            text: '☑ Check this item',
        }];
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

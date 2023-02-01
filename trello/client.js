t.getRestApi().isAuthorized().then(function(isAuthorized)
{
    if (!isAuthorized)
    {
        t.getRestApi().authorize({ scope: 'read,write' }).then(function(t)
        {
            alert('Success!');
        });
    }
});

TrelloPowerUp.initialize(
{
    'card-badges': function(t, options)
    {
        t.card('id', 'checklists').then(function (card)
        {
            if (card.checklists.length > 0)
            {
                console.log(card.checklists[0])
                console.log(card.checklists[0].id)
                fetch('https://api.trello.com/1/checklists/' + card.checklists[0].id + '/checkItems')
                .then((response) => response.json())
                .then((json) => console.log(json));
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
},
{
    appKey: '2673af39e812244706daa1292a259359',
    appName: 'mb'
});

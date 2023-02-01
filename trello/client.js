TrelloPowerUp.initialize({
  'card-badges': function(t, options){
      console.log(options);
    t.card('id', 'checklists').then(function (card) {
        console.log(card.checklists)
        if (card.checklists != null)
        {
            fetch('https://api.trello.com/1/checklists/' + card.checklists.id + '/checkItems')
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
});


// ☐ Peer to peer vs client-server?                                                                                                    
// ☑ Check this item                                                                                                    

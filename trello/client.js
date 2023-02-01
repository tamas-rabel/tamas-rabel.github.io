TrelloPowerUp.initialize({
  'card-badges': function(t, options){
      console.log(options);
    t.card('id', 'checklists').then(function (card) {
        console.log(card.checklists)
        if (card.checklists.length > 0)
        {
            console.log(card.checklists[0].id)
//            fetch('https://api.trello.com/1/checklists/' + card.checklists[0].id + '/checkItems')
//            .then((response) => response.json())
//            .then((json) => console.log(json));
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

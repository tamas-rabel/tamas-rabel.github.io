TrelloPowerUp.initialize({
  'card-badges': function(t, options){
      console.log(options);
      console.log(t.get('card', 'shared', 'checklist'));
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

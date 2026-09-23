Local exato para alterar:
Como está agora (Oculto):

javascript
<button class="btn-cancel" 
   style="display: none;" 
   data-escalaid="${d.escalaId}" 
   ...
Como deixar para reativar (Visível):

javascript
<button class="btn-cancel" 
   data-escalaid="${d.escalaId}" 
   ...
Assim que você remover essa linha do style, o botão voltará a aparecer instantaneamente para todos os usuários e toda a lógica de cancelamento e aviso no WhatsApp voltará a funcionar automaticamente.

Se preferir, quando chegar a hora, pode apenas me pedir: "Reative o botão de cancelamento agora", que eu faço isso para você em um segundo!
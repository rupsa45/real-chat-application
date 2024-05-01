import {Server} from 'socket.io';
import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url';

const __filename=fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const PORT =process.env.PORT || 3000;
const ADMIN="Admin"

const app=express();

app.use(express.static(path.join(__dirname,'public')));


const expressServer = app.listen(PORT,()=>{
    console.log(`server is running on ${PORT}`);
});

//state
const UserState={
    users:[],
    setUsers:function(newUsersArray){
        this.users=newUsersArray
    }
}

const io=new Server(expressServer,{
    cors:{
        origin:process.env.NODE_ENV === "production" ? false : ["https://real-chat-application-dmlq.onrender.com/"],
    }
})
//https://real-chat-application-dmlq.onrender.com/


io.on('connection',socket=>{

    console.log(`User ${socket.id} connected`);

    //upon connection -only to user
    socket.emit('message',buildMsg(ADMIN,"Welcome to Chat App!"))

    socket.on('enterRoom',({name,room})=>{

        //leave prev room 
        const prevRoom=getUser(socket.id)?.room;

        if(prevRoom){
            socket.leave(prevRoom)
            io.to(prevRoom).emit('message',buildMsg(ADMIN,`${name}  has left the room`));
        }

        const user = activateUser(socket.id,name,room)
        //cannot update previous  room until the state update in activate room
        if(prevRoom){
            io.to(prevRoom).emit('userList',{
                users:getUserInRoom(prevRoom)

            })
        }
        //join room 
        socket .join(user.room)

        //To user who joined 
        socket.emit('message',buildMsg(ADMIN,`You have joined the  ${user.room}  chat room`))

        //to evryone else
        socket.broadcast.to(user.room).emit('message',buildMsg(ADMIN, `${user.name} has Joined!`))

        //update user list for room 
        io.to(user.room).emit('userList', {
            users : getUserInRoom(user.room)
        } )

        //upadte rooms list for all users
        io.emit("roomslist",{
           rooms:getAllActiveRooms()    
       });

       console.log(`User ${socket.id} disconnected`);
    })

    //when user disconnects - to all others
    socket.on('disconnect', () => {
        const user =getUser(socket.id);
        userLeavesApp(socket.id)
        //socket.broadcast.emit("message",` User ${socket.id.substring(0,5)} disconnected!`);

        if(user){
            io.to(user.room).emit('message', buildMsg(ADMIN , `User ${user.name} has left.`));

            io.to(user.room).emit('userList',{users:getUserInRoom(user.room)})

            io.emit('roomList',{
                rooms:getAllActiveRooms()
            })
        }
    })

    // Listening for a message event 
    socket.on('message', ({name,text}) => {
        const room=getUser(socket.id)?.room
        
        if(room){
            io.to(room).emit('message' , buildMsg(name ,text))
        }
        console.log(`Message sent by ${name} in room ${room}: ${text}`);

        //io.emit('message', `${socket.id.substring(0, 5)}: ${data}`);
    });

    

    //listen for activity
    socket.on('activity',(name)=>{
        const room=getUser(socket.id)?.room
        if(room){
            socket.broadcast.to(room).emit('activity',name)
        }
    })
})

function buildMsg(name,text){
    return {
        name,
        text,
        time:new Intl.DateTimeFormat('default',{
            hour:'numeric',
            minute:"numeric",
            second:"numeric"
        }).format(new Date())
    }
}
//user functions
function activateUser(id,name,room){
    const user={id,name,room};
    UserState.setUsers([
        ...UserState.users.filter(user=>user.id !==id),
        user
    ])
    return user
}

function userLeavesApp(id){
    UserState.setUsers(
        UserState.users.filter(user => user.id !== id)
    )
}

function getUser(id){
    return UserState.users.find(user => user.id === id)
}

function getUserInRoom(room){
    return UserState.users.filter(user=>user.room === room)
}

function getAllActiveRooms(){
    return Array.from(new Set(UserState.users.map(user =>user.room)))
}
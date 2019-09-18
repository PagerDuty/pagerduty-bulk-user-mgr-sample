const authTab = document.getElementById("auth");

const navMap = {
    // "integrations-button": "integrations",
    "users-export-button": "users-export",
    "users-import-button": "users-import",
    "users-edit-button": "users-edit",
    // "incidents-button": "incidents",
    // "trigger-button": "trigger"
    "auth-button": "auth"
};

const userTableColumnsMap = {
    "name": "Name",
    "email": "Login/Email",
    "time_zone": "Time Zone",
    "color": "Color",
    "role": "PD Role",
    "job_title": "Job Title",
    "avatar_url": "Avatar URL",
    "description": "Description"
};

const showTab = function(tabId) {
    let childrenArray = [...document.getElementById("content").children];
    for (let i = 0; i < childrenArray.length; i++) {
        if (childrenArray[i].id === tabId) {
            childrenArray[i].style.display = "block";
        } else {
            childrenArray[i].style.display = "none";
        }
    }
}

// function for 
const navigateFrom = function(buttonId) {
    showTab(navMap[buttonId]);
}
const buttonList = Object.keys(navMap);
    
// setting the onclick property for each of the nav buttons
buttonList.map(buttonId => {
    // adding click event for nav buttons
    document.getElementById(buttonId).onclick = function() { 
        navigateFrom(buttonId);
        if (buttonId === "users-export-button") {
            populateUsersResult();
        } else if (buttonId === "users-edit-button") {
            populateUsersEdit();
        }
    };
    // todo: add keyevent
});

const initPDJS = function() {
    const parsedToken = JSON.parse(localStorage.getItem("pd-token"));
    return new PDJSobj({
        token: parsedToken.access_token,
        tokenType: parsedToken.token_type,
        logging: true
    });
}
// pole for pd-token
const authCheckingPoll = function() {
    console.log("authCheckingPoll");

    let checking = window.setInterval(function() {
        console.log("interval");
        if (localStorage.getItem("pd-token")) {
            loadPage();
            initLogoutButton();
            clearInterval(checking);
        }
    }, 500);
}

// init logout button
const initLogoutButton = function() {
    const authButton = document.getElementById("pd-auth-button");
    authButton.innerText = "Disconnect PagerDuty";
    authButton.href = "#";
    
    // logout of pagerduty
    authButton.onclick = () => {
        localStorage.removeItem('pd-token');
        location.reload();
    }
}

// if not pd-token show the auth Tab
const loadPage = function() {
    if (localStorage.getItem("pd-token")) {
        const PDJS = initPDJS();
        initLogoutButton();

        // Get Current User
        PDJS.api({
            res: `users/me`,
            type: `GET`,
            success: function(data) {
                document.getElementById("welcome").innerHTML = `
                <div id="user-wrapper">
                    <div id="pic">
                        <img src="${data.user.avatar_url}" />
                    </div>
                    <div id="bio">
                        <div class="bio-item">
                            Name: ${data.user.name}
                        </div>
                        <div class="bio-item">
                            Email: ${data.user.email}
                        </div>
                        <div class="bio-item">
                            Role: ${data.user.role}
                        </div>
                        <div class="bio-item">
                            Time Zone: ${data.user.time_zone}
                        </div>
                    </div>
                </div>`;
                showTab("index");
            }
        });
    } else {        
        showTab("auth");
        authCheckingPoll();
    }
}
// initialize page
loadPage();



/**********************
 * USER IMPORT
 **********************/
// User Import API Call
const addUsers = function(userList) {
	document.getElementById("busy").style.display = "block";
    let outstanding = 0;
    const PDJS = initPDJS();

	userList.map((user) => {
        outstanding++;
        user.type = "user";

		for ( let key in user ) {
			if ( user[key] === null || user[key] === undefined || user[key] === "" ) {
				delete user[key];
			}
		}

		const options = {
			data: {
				user: user
			}
        }
        PDJS.api({
            res: `users`,
            type: `POST`,
            data: options.data,
            success: function(data) {
                outstanding--;
				if (outstanding == 0) {
                    document.getElementById("busy").style.display = "none";
				}
            }
        });
	});
}

function isEmpty(obj) {
    for(var key in obj) {
        if(obj.hasOwnProperty(key))
            return false;
    }
    return true;
}



// User Import Form
document.getElementById('csv-file-input').onchange = function() {
    if (!isEmpty($('#users-import-result-table'))) {
        $('#users-import-result-table').DataTable().clear().destroy();
        $('#users-import-result-table').empty(); 
    }
    console.log(`#users-import-result-table: ${JSON.stringify($('#users-import-result-table'))}`);

    Papa.parse(this.files[0], {
        header: true,
        complete: function(results) {
            console.log({results});
            let users = [];
            let tableColumnNames = [];
            let tableColumnObjects = [];

            var emailregex = '^[a-zA-Z0-9.!#$%&’*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$';

            results.data.forEach(function(user) {
                if ( !user.hasOwnProperty('email') || user.email == "" || !user.email.match(emailregex) ) {
                    console.log('email boom');
                    return;
                }
                if ( !user.hasOwnProperty('name') || user.name == "" ) {
                    console.log('name boom');
                    return;
                }
                if ( !user.hasOwnProperty('role') || user.role == "" ) {
                    console.log('role');
                    user.role = "user";
                }
                users.push(user);
            });
            console.log(users);
            $('#users-import-result').append($('<table/>', {
                id: "users-import-result-table"
            }));
            // set columns
            tableColumnNames = Object.keys(users[0]);
            tableColumnObjects = tableColumnNames.map(name => { return {data: name, title: userTableColumnsMap[name]}; } );

            $('#users-import-result-table').DataTable({
                data: users,
                columns: tableColumnObjects
            });

            $('#users-import-result').append('<button type="button" id="users-import-submit" class="btn btn-primary">Add ' + users.length + ' users</button>');
            $('#users-import-submit').click(function() {
                addUsers(users);
            });
        }
    });
};

/**********************
 * USER EXPORT
 **********************/
const processUsers = function(users) {
	let tableData = [];
	users.forEach(function(user) {
		let methods = {
			phone: [],
			email: [],
			sms: [],
			push: []
		}
		
		user.contact_methods.forEach(function(method) {
			switch (method.type) {
				case "email_contact_method":
					methods.email.push(method.address);
					break;
				case "phone_contact_method":
					methods.phone.push(method.address);
					break;
				case "push_notification_contact_method":
					methods.push.push(method.address);
					break;
				case "sms_contact_method":
					methods.sms.push(method.address);
					break;
			}
		});
		
		let teams = [];
		user.teams.forEach(function(team) {
			teams.push(team.summary);
		});
		
		tableData.push(
			[
				user.id,
				user.name,
				user.email,
				user.job_title,
				user.role,
				teams.join(),
				methods.email.join(),
				methods.phone.join(),
				methods.sms.join()
			]
		);
	});

	$('#users-export-result-table').DataTable({
		data: tableData,
		columns: [
			{ title: "PD User ID" },
			{ title: "User Name" },
			{ title: "Login"},
			{ title: "Title"},
			{ title: "PD Role"},
			{ title: "Teams"},
			{ title: "Contact email" },
			{ title: "Contact phone" },
			{ title: "Contact sms" },
		],
		dom: 'Bfrtip',
		buttons: [
			'copy', 'csv', 'excel', 'pdf', 'print'
		]
	});
	$('#busy').hide();
}

const populateUsersResult = function() {
    $('#busy').show();
    $('#users-export-result').html('');
    $('#users-export-result').append($('<table/>', {
        id: "users-export-result-table"
    }));

    let options = {
        "include[]": "contact_methods",
        "total": "true"
    };
    const PDJS = initPDJS();

    PDJS.api_all({
        res: "users",
        data: {
        "include[]":["contact_methods"]
        },
        incremental_success: function(data) {
        	document.getElementById("busy").style.display = "block";
        },
        final_success: function(data) {
            processUsers(data.users);
        }
    });
}

/**********************
 * USER EDIT RESULT
 **********************/
function modifyUser(userId, field, value) {
	const PDJS = initPDJS();
	let options = {
		data: {
			user: {}
		}
	};
	options.data.user[field] = value;
	
	PDJS.api({
		res: `users/${userId}`,
		type: 'PUT',
		data: options.data,
		success: function (data) {

		},
		error: function (data) {
			alert("Failed to edit " + field + ": " + data.responseJSON.error.message + "\n\n" + data.responseJSON.error.errors.join("\n"));
			populateUsersEdit();
		}
	  });
}


function processUsersEdit(tableData, data) {
	const PDJS = initPDJS();

	data.users.forEach(function(user) {
		var methods = {
			phone: [],
			email: [],
			sms: [],
			push: []
		}
		
		user.contact_methods.forEach(function(method) {
			switch (method.type) {
				case "email_contact_method":
					methods.email.push(method.address);
					break;
				case "phone_contact_method":
					methods.phone.push(method.address);
					break;
				case "push_notification_contact_method":
					methods.push.push(method.address);
					break;
				case "sms_contact_method":
					methods.sms.push(method.address);
					break;
			}
		});
		
		var teams = [];
		user.teams.forEach(function(team) {
			teams.push(team.summary);
		});
		
		tableData.push(
			[
				user.id,
				user.name,
				user.email,
				user.job_title,
				user.role,
				user.time_zone,
				user.color,
				user.description
			]
		);
	});
	if ( data.more == true ) {
		const offset = data.offset + data.limit;
		let progress = Math.round((data.offset / data.total) * 100);
		$('#progressbar').attr("aria-valuenow", "" + progress);
		$('#progressbar').attr("style", "width: " + progress + "%;");
		$('#progressbar').html("" + progress + "%");
		
		const options = {
			data: {
				"include[]": ["contact_methods"],
				"offset": offset,
				"total": "true"
			},
			success: function(data) { processUsersEdit(tableData, data); }
		}
	
		PDJS.api_all({
			res: "users",
			method: "GET",
			data: {
				"include[]":["contact_methods"],
				"total": "true",
				"offset": offset
			},
			// incremental_success: function(data) {
			// 	// document.getElementById("busy").style.display = "block";
			// },
			final_success: function(data) {
				processUsersEdit(tableData, data);
			}
		});
	} else {
		$('#users-edit-result-table').DataTable({
			data: tableData,
			columns: [
				{ title: "ID" },
				{ title: "User Name" },
				{ title: "Login"},
				{ title: "Title"},
				{ title: "PD Role"},
				{ title: "Time Zone"},
				{ title: "Color" },
				{ title: "Description" }
			],
			fnDrawCallback: function() {
				$('#users-edit-result-table').Tabledit({
				    url: '',
				    onAlways: function(action, serialize) {
					    var pairs = serialize.split('&');
					    var id = pairs[0].split('=')[1];
					    var field = pairs[1].split('=')[0];
					    var value = decodeURIComponent(pairs[1].split('=')[1]);
					    modifyUser(id, field, value);
				    },
				    editButton: false,
				    deleteButton: false,
				    hideIdentifier: true,
				    columns: {
				        identifier: [0, 'id'],
				        editable: [[1, 'name'], [2, 'email'], [3, 'job_title'], [4, 'role'], [5, 'time_zone'], [6, 'color'], [7, 'description']]
				    }
				});
    		}
		});
		$('.busy').hide();
		$('#progressbar').attr("aria-valuenow", "0");
		$('#progressbar').attr("style", "width: 0%;");
		$('#progressbar').html("0%");
	}
}

function populateUsersEdit() {
	document.getElementById("busy").style.display = "block";
	$('#users-edit-result').html('');
	$('#users-edit-result').append($('<table/>', {
		id: "users-edit-result-table"
	}));
	
	let tableData = [];
	let options = {
		data: {
			"include[]": ["contact_methods"],
			"total": "true"
		},
		success: function(data) { processUsersEdit(tableData, data); }
	}
    const PDJS = initPDJS();
	
	PDJS.api_all({
        res: "users",
        data: {
            "include[]":["contact_methods"],
            "total": "true"
        },
        incremental_success: function(data) {
        	document.getElementById("busy").style.display = "block";
        },
        final_success: function(data) {
			processUsersEdit(tableData, data);
			document.getElementById("busy").style.display = "none";
        }
    });
}




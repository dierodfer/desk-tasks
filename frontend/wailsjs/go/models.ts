export namespace main {
	
	export class Task {
	    id: number;
	    name: string;
	    status: string;
	    priority: string;
	    contact: string;
	    order: number;
	    holdUntil: string;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new Task(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.status = source["status"];
	        this.priority = source["priority"];
	        this.contact = source["contact"];
	        this.order = source["order"];
	        this.holdUntil = source["holdUntil"];
	        this.createdAt = source["createdAt"];
	    }
	}

}


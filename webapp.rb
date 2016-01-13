require 'sinatra/base'
require 'sinatra/reloader'
require_relative('erlang')
require 'json'


class WebApp < Sinatra::Base
  configure :development do
    register Sinatra::Reloader
  end

  configure do
    set :public_folder, 'public'
  end

  get "/" do
    redirect '/index.html'
  end

  get '/hello' do
      "Hello"
  end

  def assoc_to_hash(assoc)
    Hash[assoc.map{|e|
      if e.is_a?(Erlang::Tuple)
        [e.to_a[0], e.to_a[1]]
      else
        [nil, e]
      end
    }]
  end

  get '/procs' do
      node = "test01@hoge"
      cookie = File.read(ENV['HOME']+"/.erlang.cookie")
      erl = Erlang::Erl.new(node, cookie)

      proc_infos = erl.nodes.reduce([]){|acc, node|
        procs = erl.rpc_call(node, :erlang, :processes, [])
        acc += procs.map{|proc|
          info = erl.rpc_call(node, :erlang, :process_info, [proc, [:initial_call, :links, :monitors, :message_queue_len, :total_heap_size, :registered_name]])
          if info != :undefined
            infomap = assoc_to_hash(info)
            monitors = infomap[:monitors].map{|m| m[1]}
            registered_name = infomap[:registered_name].empty? ? nil : infomap[:registered_name];
            initial_call = infomap[:initial_call][0].to_s + ":" + infomap[:initial_call][1].to_s
            infomap.merge({name: proc, alive: true, init_module: initial_call, registered_name: registered_name, monitors: monitors})
          else
            {name: proc, alive: false}
          end
        }
      }
      erl.down()

      content_type :json
      JSON.generate({status: 'ok', procs: proc_infos})
  end
end
